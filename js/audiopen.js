var audiopen = null;

window.onload = function () {

    nx.colorize("orange");
    nx.colorize("border", "#161616");
    nx.colorize("fill", "#000");
    nx.sendsTo("js");

    vca.val.x = 0;
    vca.val.y = 0;
    vcb.val.x = 0;
    vcb.val.y = 0;
    vcc.val.x = 0;
    vcc.val.y = 0;
    vcd.val.x = 0;
    vcd.val.y = 0;

    audiopen = new AudioPen();
    audiopen.start();
};

function AudioPen() {
    this.apiFunctionNames = ["process"];
    this.isPlaying = false;
    this.compiledCode = null;
    this.lastCodeChangeTime = 0;
    this.lastCompilationTime = 0;
    this.compilationDelay = 1E3;
    this.sampleRate = 44100;
    this.bufferSize = 2048;
    this.t = 0;
}

function AudioPenAPI(a) {
    var core = a;
    this.sampleRate = function () {
        return core.sampleRate;
    };
}

AudioPen.prototype = {
    start: function () {

        var self = this;

        this.editor = ace.edit("editor");
        this.editor.setTheme("ace/theme/chaos");
        this.editor.setShowPrintMargin(false);
        this.editor.getSession().setMode("ace/mode/javascript");
        this.editor.on("change", function (e) {
            self.lastCodeChangeTime = Date.now();
        });

        this.playButton = document.getElementById("play");
        this.playButton.addEventListener("click", function () {
            self.onPlayToggle();
        });

        this.stopButton = document.getElementById("stop");
        this.stopButton.addEventListener("click", function () {
            self.onStopToggle();
        });

        this.waveform = document.getElementById("waveform");
        this.waveformContext = this.waveform.getContext("2d");

        this.compileCode();
        this.channelCount = 1;
        this.audioContext = new window.AudioContext();
        this.audioBuffer = this.audioContext.createBuffer(this.channelCount, this.sampleRate, this.sampleRate);
        this.bufferSource = this.audioContext.createScriptProcessor(this.bufferSize, 0, 1);
        this.bufferSource.onaudioprocess = function (e) {
            var buffer = e.outputBuffer.getChannelData(0);
            self.executeCode(buffer);
        };

        this.bufferSource.connect(this.audioContext.destination);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftsize = 1024;
        this.bufferSource.connect(this.analyser);
        this.amplitudeData = new Uint8Array(this.analyser.frequencyBinCount);
        this.mainLoop();
    },
    compileCode: function () {
        var code = this.editor.getValue();
        var memberDefs = [];
        for (var i = 0; i < this.apiFunctionNames.length; ++i) {
            var fname = this.apiFunctionNames[i];
            memberDefs.push(fname + ":(typeof " + fname + "=='function'?" + fname + ":null)");
        }
        var appendix = "\nreturn {" + memberDefs.join(",") + " };";
        code += appendix;
        this.lastCompilationTime = Date.now();
        var pack = null;
        try {
            pack = (new Function(code))();
        } catch (ex) {
            console.log("Compilation failed: " + ex.message + "\n" + ex.stack);
            return false;
        }
        this.compiledCode = pack;
        return true;
    },
    executeCode: function (buffer) {
        if (buffer === null) return;
        try {
            if (this.isPlaying) {
                buffer = this.compiledCode.process(buffer);
            } else {
                for (var i = 0; i < buffer.length; ++i) {
                    buffer[i] = 0;
                }
            }
        } catch (ex) {
            console.log("Execution error: " + ex.message + "\n" + ex.stack);
        }
    },
    onPlayToggle: function () {
        this.isPlaying = true;
    },
    onStopToggle: function () {
        this.isPlaying = false;
    },
    mainLoop: function () {
        var self = this;
        requestAnimationFrame(function () {
            self.mainLoop();
        });
        if (Date.now() - this.lastCodeChangeTime > this.compilationDelay && this.lastCodeChangeTime > this.lastCompilationTime) this.compileCode();
        if (this.compiledCode.onGui) this.compiledCode.onGui();
        this.analyser.getByteTimeDomainData(this.amplitudeData);
        this.renderWave();
    },
    renderWave: function () {
        var g = this.waveformContext;
        var canvas = this.waveform;
        g.fillStyle = "#000";
        g.fillRect(0, 0, canvas.width, canvas.height);
        g.strokeStyle = "orange";
        g.beginPath();
        for (var i = 0, x = 0; i < this.amplitudeData.length; i++) {
            y = (0.875 - 0.00292969 * this.amplitudeData[i]) * canvas.height;
            if (i === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
            x += canvas.width / this.amplitudeData.length;
        }
        g.lineWidth = 1;
        g.stroke();
    }
};