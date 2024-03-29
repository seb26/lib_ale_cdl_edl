// https://github.com/bradcordeiro/timecode-boss/blob/master/dist/timecode.js
var TimecodeRegex = /(\d{1,2})\D(\d{1,2})\D(\d{1,2})\D(\d{1,2})/;
var SecondsInOneMinute = 60;
var MinutesInOneHour = 60;
var HoursInOneDay = 24;
var Timecode = (function () {
    function Timecode(timecode, frameRate) {
        if (frameRate === void 0) { frameRate = 29.97; }
        this.hours = 0;
        this.minutes = 0;
        this.seconds = 0;
        this.frames = 0;
        this.frameRate = frameRate;
        if (timecode instanceof Date) {
            this.setFieldsFromDate(timecode);
        }
        else if (typeof timecode === 'number') {
            this.setFieldsFromFrameCount(timecode);
        }
        else if (typeof timecode === 'string') {
            this.setFieldsFromString(timecode);
        }
        else if (typeof timecode === 'object') {
            this.setFieldsFromObject(timecode);
            if (timecode.frameRate) {
                this.frameRate = timecode.frameRate;
            }
        }
    }
    Timecode.isValidTimecodeString = function (str) {
        return TimecodeRegex.test(str);
    };
    Timecode.prototype.setFieldsFromFrameCount = function (input) {
        var remainingFrames = input;
        this.setHours(Math.trunc(remainingFrames / this.framesPerHour()));
        remainingFrames -= this.framesInHoursField();
        var tenMinutes = Math.trunc(remainingFrames / this.framesPer10Minute());
        remainingFrames -= this.framesPer10Minute() * tenMinutes;
        var singleMinutes = Math.trunc(remainingFrames / this.framesPerMinute());
        this.setMinutes((tenMinutes * 10) + singleMinutes);
        remainingFrames -= singleMinutes * this.framesPerMinute();
        this.setSeconds(Math.trunc(remainingFrames / this.nominalFrameRate()));
        remainingFrames -= this.framesInSecondsField();
        this.setFrames(remainingFrames);
    };
    Timecode.prototype.setFieldsFromString = function (input) {
        var matches = TimecodeRegex.exec(input);
        if (matches && matches.length === 5) {
            var hh = matches[1], mm = matches[2], ss = matches[3], ff = matches[4];
            var hours = parseInt(hh, 10);
            var minutes = parseInt(mm, 10);
            var seconds = parseInt(ss, 10);
            var frames = parseInt(ff, 10);
            return this.setFieldsFromObject({
                hours: hours,
                minutes: minutes,
                seconds: seconds,
                frames: frames,
            });
        }
        throw new TypeError("Invalid timecode string ".concat(input));
    };
    Timecode.prototype.setFieldsFromObject = function (input) {
        if (input.hours)
            this.hours = input.hours;
        if (input.minutes)
            this.minutes = input.minutes;
        if (input.seconds)
            this.seconds = input.seconds;
        if (input.frames)
            this.frames = input.frames;
        if (input.hours)
            this.setHours(input.hours);
        if (input.minutes)
            this.setMinutes(input.minutes);
        if (input.seconds)
            this.setSeconds(input.seconds);
        if (input.frames)
            this.setFrames(input.frames);
        return this;
    };
    Timecode.prototype.setFieldsFromDate = function (date) {
        return this.setFieldsFromObject({
            hours: date.getHours(),
            minutes: date.getMinutes(),
            seconds: date.getSeconds(),
            frames: Math.trunc(date.getMilliseconds() / this.nominalFrameRate()),
        });
    };
    Timecode.prototype.valueOf = function () {
        return this.frameCount();
    };
    Timecode.prototype.toString = function () {
        var c = this.separator();
        var h = (this.hours < 10 ? '0' : '') + this.hours.toString(10);
        var m = (this.minutes < 10 ? '0' : '') + this.minutes.toString(10);
        var s = (this.seconds < 10 ? '0' : '') + this.seconds.toString(10);
        var f = (this.frames < 10 ? '0' : '') + this.frames.toString(10);
        return "".concat(h, ":").concat(m, ":").concat(s).concat(c).concat(f);
    };
    Timecode.prototype.toSRTString = function (realTime) {
        if (realTime === void 0) { realTime = false; }
        var tc = new Timecode(this);
        if (realTime === true) {
            tc = this.pulldown(29.97);
        }
        var h = tc.hours.toString(10).padStart(2, '0');
        var m = tc.minutes.toString(10).padStart(2, '0');
        var s = tc.seconds.toString(10).padStart(2, '0');
        var milliseconds = tc.milliseconds().toString(10).substr(2, 3);
        var mm = milliseconds.padEnd(3, '0');
        return "".concat(h, ":").concat(m, ":").concat(s, ",").concat(mm);
    };
    Timecode.prototype.toObject = function () {
        return {
            hours: this.hours,
            minutes: this.minutes,
            seconds: this.seconds,
            frames: this.frames,
            frameRate: this.frameRate,
        };
    };
    Timecode.prototype.setHours = function (hours) {
        this.hours = hours % HoursInOneDay;
        while (this.hours < 0)
            this.hours += HoursInOneDay;
        this.incrementIfDropFrame();
        return this;
    };
    Timecode.prototype.setMinutes = function (minutes) {
        this.minutes = minutes % MinutesInOneHour;
        this.setHours(this.hours + Math.trunc(minutes / MinutesInOneHour));
        if (this.minutes < 0) {
            this.minutes += MinutesInOneHour;
            this.setHours(this.hours - 1);
        }
        this.incrementIfDropFrame();
        return this;
    };
    Timecode.prototype.setSeconds = function (seconds) {
        this.seconds = seconds % SecondsInOneMinute;
        this.setMinutes(this.minutes + Math.trunc(seconds / SecondsInOneMinute));
        if (this.seconds < 0) {
            this.seconds += SecondsInOneMinute;
            this.setMinutes(this.minutes - 1);
        }
        this.incrementIfDropFrame();
        return this;
    };
    Timecode.prototype.setFrames = function (frames) {
        if (frames === undefined)
            return this;
        var nominalFrameRate = this.nominalFrameRate();
        this.frames = frames % nominalFrameRate;
        this.setSeconds(this.seconds + Math.trunc(frames / nominalFrameRate));
        if (this.frames < 0) {
            this.frames += this.nominalFrameRate();
            this.setSeconds(this.seconds - 1);
        }
        this.incrementIfDropFrame();
        return this;
    };
    Timecode.prototype.nominalFrameRate = function () {
        return Math.round(this.frameRate);
    };
    Timecode.exactFrameRate = function (frameRate) {
        if (frameRate > 59 && frameRate < 60) {
            return 60000 / 1001;
        }
        if (frameRate > 29 && frameRate < 30) {
            return 30000 / 1001;
        }
        if (frameRate > 23 && frameRate < 24) {
            return 24000 / 1001;
        }
        return frameRate;
    };
    Timecode.prototype.frameCount = function () {
        return this.framesInHoursField()
            + this.framesInMinutesField()
            + this.framesInSecondsField()
            + this.frames;
    };
    Timecode.prototype.fractionalSeconds = function () {
        return this.seconds + this.milliseconds();
    };
    Timecode.prototype.framesPerHour = function () {
        return this.framesPer10Minute() * 6;
    };
    Timecode.prototype.framesPer10Minute = function () {
        return (this.framesPerMinute() * 10) + this.framesToDrop();
    };
    Timecode.prototype.framesPerMinute = function () {
        return (60 * this.nominalFrameRate()) - this.framesToDrop();
    };
    Timecode.prototype.milliseconds = function () {
        return this.frames / this.nominalFrameRate();
    };
    Timecode.prototype.framesToDrop = function () {
        return this.isDropFrame() ? this.nominalFrameRate() / 15 : 0;
    };
    Timecode.prototype.isDropFrame = function () {
        if (this.frameRate > 29 && this.frameRate < 30)
            return true;
        if (this.frameRate > 59 && this.frameRate < 60)
            return true;
        return false;
    };
    Timecode.prototype.incrementIfDropFrame = function () {
        if (this.isDropFrame() && this.frames < 2 && this.seconds === 0 && this.minutes % 10 !== 0) {
            this.frames += 2;
        }
    };
    Timecode.prototype.separator = function () {
        return this.isDropFrame() ? ';' : ':';
    };
    Timecode.prototype.framesInHoursField = function () {
        return this.hours * this.framesPerHour();
    };
    Timecode.prototype.framesInMinutesField = function () {
        return ((Math.trunc(this.minutes / 10) * this.framesPer10Minute())
            + ((this.minutes % 10) * this.framesPerMinute()));
    };
    Timecode.prototype.framesInSecondsField = function () {
        return this.seconds * this.nominalFrameRate();
    };
    Timecode.prototype.add = function (addend) {
        var tc = new Timecode(this);
        if (!(addend instanceof Timecode)) {
            return tc.add(new Timecode(addend, this.frameRate));
        }
        if (this.frameRate !== addend.frameRate) {
            return tc.add(addend.pulldown(this.frameRate));
        }
        tc.setHours(this.hours + addend.hours);
        tc.setMinutes(this.minutes + addend.minutes);
        tc.setSeconds(this.seconds + addend.seconds);
        tc.setFrames(this.frames + addend.frames);
        return tc;
    };
    Timecode.prototype.subtract = function (subtrahend) {
        var tc = new Timecode(this);
        if (!(subtrahend instanceof Timecode)) {
            var newSubtrahend = new Timecode(subtrahend, this.frameRate);
            return tc.subtract(newSubtrahend);
        }
        if (this.frameRate !== subtrahend.frameRate) {
            var newSubtrahend = subtrahend.pulldown(this.frameRate);
            return tc.subtract(newSubtrahend);
        }
        tc.setHours(this.hours - subtrahend.hours);
        tc.setMinutes(this.minutes - subtrahend.minutes);
        tc.setSeconds(this.seconds - subtrahend.seconds);
        tc.setFrames(this.frames - subtrahend.frames);
        return tc;
    };
    Timecode.prototype.pulldown = function (frameRate, start) {
        if (start === void 0) { start = 0; }
        var oldBase = new Timecode(start, this.frameRate);
        var newBase = new Timecode(start, frameRate);
        var output = new Timecode(0, frameRate);
        var outputFrames = this.subtract(oldBase).frameCount();
        outputFrames *= output.nominalFrameRate();
        outputFrames /= this.nominalFrameRate();
        outputFrames = Math.ceil(outputFrames);
        output.setFieldsFromFrameCount(outputFrames);
        return output.add(newBase);
    };
    Timecode.prototype.pullup = function (frameRate, start) {
        if (start === void 0) { start = 0; }
        return this.pulldown(frameRate, start);
    };
    return Timecode;
}());
// export default Timecode;
