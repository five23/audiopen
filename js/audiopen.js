/*
 * audiopen.js
 * @author David Scott Kirby
 */

var audiopen = null;

/**
 * onload
 */
window.onload = function () {

    nx.colorize("orange");
    nx.colorize("border", "#161616");
    nx.colorize("fill", "#000");
    nx.showLabels = true;
    nx.sendsTo("js");
     
    // Reset vca to zero
    vca.val.x = 0, vca.val.y = 0, vca.theta = 0, vca.step = 0,
    vca.n = 0, vca.out = 0, vca.amp = 0, vca.fb = 0; vca.draw();
    
    // Reset vcb to zero
    vcb.val.x = 0, vcb.val.y = 0, vcb.theta = 0, vcb.step = 0, 
    vcb.n = 0, vcb.out = 0, vcb.amp = 0, vcb.fb = 0; vcb.draw();

    // Reset vcc to zero
    vcc.val.x = 0, vcc.val.y = 0, vcc.theta = 0, vcc.step = 0, 
    vcc.n = 0, vcc.out = 0, vcc.amp = 0, vcc.fb = 0; vcc.draw();
    
    cca1.val = 0.5; cca1.draw();
    cca2.val = 0.5; cca2.draw();
    cca3.val = 0.5; cca3.draw();
    cca4.val = 0; cca4.draw();
    cca5.val = 0; cca5.draw();
    
    ccb1.val = 0.5; ccb1.draw();
    ccb2.val = 0.5; ccb2.draw();
    ccb3.val = 0.5; ccb3.draw();
    ccb4.val = 0; ccb4.draw();
    ccb5.val = 0; ccb5.draw();

    ccc1.val = 0.5; ccc1.draw();
    ccc2.val = 0.5; ccc2.draw();
    ccc3.val = 0.5; ccc3.draw();
    ccc4.val = 0; ccc4.draw();
    ccc5.val = 0; ccc5.draw();
    
    fxa.val = 0, fxa.n = 0, fxa.draw();
    fxb.val = 0.75, fxb.n = 0, fxb.draw();
    fxc.val = 0.75, fxc.n = 0, fxc.draw();

    audiopen = new AudioPen();
    audiopen.start();
};

/**
 * AudioPen
 */
function AudioPen() {
    this.apiFunctionNames = ["process"];
    this.isPlaying = false;
    this.compiledCode = null;
    this.lastCodeChangeTime = 0;
    this.lastCompilationTime = 0;
    this.compilationDelay = 1E3;
    this.sampleRate = 48000;
    this.bufferSize = 1024;
    this.t = 0;
}

/**
 * AudioPen.prototype
 */
AudioPen.prototype = {

    /**
     * start
     */
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
        this.audioContext = new (window.AudioContext || window.webkitAudioContext);
        this.gainNode = this.audioContext.createGain();
        this.audioBuffer = this.audioContext.createBuffer(this.channelCount, this.sampleRate, this.sampleRate);
        this.bufferSource = this.audioContext.createScriptProcessor(this.bufferSize, 0, 1);
        this.bufferSource.onaudioprocess = function (e) {
            var buffer = e.outputBuffer.getChannelData(0);
            self.executeCode(buffer);
        };

        this.bufferSource.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
        this.gainNode.gain.setValueAtTime(0.25, this.audioContext.currentTime);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftsize = 1024;
        this.bufferSource.connect(this.analyser);
        this.amplitudeData = new Uint8Array(this.analyser.frequencyBinCount);
        this.mainLoop();
    },

    /**
     * compileCode
     * @returns {Boolean}
     */
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

    /**
     * executeCode
     * @param {Audio} buffer
     */
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

    /**
     * onPlayToggle
     */
    onPlayToggle: function () {
      if (!this.isPlaying) {
        audiopen.audioContext.resume().then(() => {
          console.log('Playback resumed successfully');
        });
        this.isPlaying = true;
      } else {
        this.isPlaying = false;
      }
    },

    /**
     * onStopToggle
     */
    onStopToggle: function () {
        this.isPlaying = false;
    },

    /**
     * mainLoop
     */
    mainLoop: function () {

        var self = this;

        requestAnimationFrame(function () {
            self.mainLoop();
        });

        if (Date.now() - this.lastCodeChangeTime > this.compilationDelay && this.lastCodeChangeTime > this.lastCompilationTime) {
            this.compileCode();
        }

        this.analyser.getByteTimeDomainData(this.amplitudeData);

        this.renderWave();
    },

    /**
     * renderWave
     */
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
