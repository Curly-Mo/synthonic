var audioContext;
var graph_in;
var analyser;

var graphs = ['spectrum', 'spectrogram', 'oscilloscope', 'waveform', 'cepstrum'];
var canvasCtx = {};
var scriptProcs = {};
var tempCtx;

var waveform_x = 0;
var waveform_y = 150;

var num_plots;


function init() {
    window.AudioContext = window.AudioContext||window.webkitAudioContext;
    try {
        if (typeof audioContext == 'undefined' || audioContext == null){
            audioContext = new AudioContext();
        }
    }catch(e) {
        alert('Web Audio API is not supported in this browser');
    }finally{
        //var audio = document.getElementById('player');
        //source = audioContext.createBufferSource();
        //source.connect(audioContext.destination);

        graph_in = audioContext.createGain();

        analyser = audioContext.createAnalyser();
        analyser.smoothingTimeConstant = 0;
        // Safari doesn't support higher fftSize
        if (navigator.userAgent.indexOf('Safari') > -1 && navigator.userAgent.indexOf('Chrome') <= -1){
            analyser.fftSize = 2048;
        }else{
            analyser.fftSize = 4096;
        }
        graph_in.connect(analyser);

        initCanvas();
    }
    navigator.getUserMedia = navigator.getUserMedia ||
                             navigator.webkitGetUserMedia ||
                             navigator.mozGetUserMedia ||
                             navigator.msGetUserMedia;
}

function initCanvas() {
    var canvas;
    scripts = {
      'spectrum': drawSpectrum,
      'spectrogram': drawSpectrogram,
      'oscilloscope': drawOscilloscope,
      'waveform': drawWaveform,
      'cepstrum': drawCepstrum
    }
    for (var i = 0; i < graphs.length; i++) {
        graph = graphs[i];
        canvas = document.getElementById(graph);
        if (canvas) {
          canvasCtx[graph] = canvas.getContext('2d');
          canvas.width = canvas.offsetWidth;
          canvas.height = canvas.offsetHeight;

          //Safari requires a bufferSize
          if (navigator.userAgent.indexOf('Safari') > -1 && navigator.userAgent.indexOf('Chrome') <= -1){
              scriptProcs[graph] = audioContext.createScriptProcessor(1024);
          }else{
              scriptProcs[graph] = audioContext.createScriptProcessor(1024);
          }
          scriptProcs[graph].connect(audioContext.destination);
          analyser.connect(scriptProcs[graph]);
          scriptProcs[graph].onaudioprocess = scripts[graph];
        }
    }
    num_plots = Object.keys(canvasCtx).length;

    var tempCanvas = document.createElement("canvas");
    tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width=canvasCtx['spectrogram'].canvas.width;
    tempCanvas.height=canvasCtx['spectrogram'].canvas.height;

    update_graph_heights();

    var remove_buttons = document.getElementsByClassName('remove_button');
    for(var i=0; i<remove_buttons.length; i++) {
        remove_buttons[i].addEventListener("click", remove_parent, false);
    }
}

function drawOscilloscope() {
    if (!document.getElementById("oscilloscope")){
        return;
    }
    var array = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(array);
    var canvas = canvasCtx['oscilloscope'].canvas;
    canvasCtx['oscilloscope'].clearRect(0,0,canvas.width,canvas.height);

    binWidth = (canvas.width)/(analyser.frequencyBinCount-1);
    canvasCtx['oscilloscope'].lineWidth = 3;
    canvasCtx['oscilloscope'].strokeStyle = 'rgb(255, 255, 255)';
    canvasCtx['oscilloscope'].beginPath();

    // var max = 0.0;
    // for (var i = 0; i < array.length; i++) {
    //     var value = array[i] - 128;
    //     if (Math.abs(value) > max) {
    //         max = value;
    //     }
    // }

    for (var i = 0; i < array.length; i++) {
            // var value;
            // if (max!=0){
            //     value = ((array[i]-128)*0.05/max) + 0.5;
            // }else{
            //     value = 0.5;
            // }
            var value = array[i]/256;
            x = i*binWidth;
            y = value * canvas.height;
            if(i === 0) {
                canvasCtx['oscilloscope'].moveTo(x, y);
            } else {
                canvasCtx['oscilloscope'].lineTo(x, y);
            }
    }
    //ctx_oscilloscope.lineTo(canvas.width, canvas.height/2);
    canvasCtx['oscilloscope'].stroke();
};

function drawWaveform() {
    var array = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(array);
    var canvas = canvasCtx['waveform'].canvas;

    totalSamples = 999999;
    timeBinWidth = (canvas.width)/(totalSamples/scriptProcs['waveform'].bufferSize);
    if(isNaN(timeBinWidth)){
        return;
    }

    canvasCtx['waveform'].lineWidth = 1;
    canvasCtx['waveform'].strokeStyle = 'rgb(255, 255, 255)';
    canvasCtx['waveform'].beginPath();
    canvasCtx['waveform'].moveTo(waveform_x, waveform_y);
    for (var i = 0; i < array.length; i++) {
        var value = array[Math.floor(i)] / 256;
        waveform_x += timeBinWidth/array.length;
        if (waveform_x > canvas.width){
            waveform_x = 0;
            canvasCtx['waveform'].clearRect(0,0,canvas.width,canvas.height);
            canvasCtx['waveform'].moveTo(waveform_x, waveform_y);
        }
        waveform_y = value * canvas.height;
        canvasCtx['waveform'].lineTo(waveform_x, waveform_y);
    }
    canvasCtx['waveform'].stroke();
};

function drawSpectrum() {
    var array =  new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    canvasCtx['spectrum'].clearRect(0, 0, canvasCtx['spectrum'].canvas.width, canvasCtx['spectrum'].canvas.height);
    canvasCtx['spectrum'].fillStyle=make_gradient(canvasCtx['spectrum']);
    var binWidth = canvasCtx['spectrum'].canvas.width/analyser.frequencyBinCount;
    for ( var i = 0; i < (array.length); i++ ){
        var value = canvasCtx['spectrum'].canvas.height*array[i]/256;
        canvasCtx['spectrum'].fillRect(i*binWidth,canvasCtx['spectrum'].canvas.height,binWidth,-value);
    }
};

function drawSpectrogram() {
    //Copy current canvas to temp canvas
    canvas = canvasCtx['spectrogram'].canvas;
    tempCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height);

    var array = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);

    audioDuration = 1;
    totalSamples = 999999;
    timeBinWidth = canvas.width/(totalSamples/scriptProcs['spectrogram'].bufferSize);
    timeBinWidth = Math.max(timeBinWidth, 1);
    freqBinWidth = canvas.height/analyser.frequencyBinCount;

    for (var i = 0; i < array.length; i++) {
            var value = array[i];
            // draw the line at the right side of the canvas
            canvasCtx['spectrogram'].fillStyle = "#" + value.toString(16)+value.toString(16)+value.toString(16);
            //canvasCtx['spectrogram'].fillStyle = 'hsl(' + (256-value) + ',100%,50%)';

            canvasCtx['spectrogram'].fillRect(canvas.width - timeBinWidth, canvas.height - i*freqBinWidth, timeBinWidth, canvas.height/array.length);
    }
    canvasCtx['spectrogram'].translate(-timeBinWidth, 0);
    canvasCtx['spectrogram'].drawImage(tempCtx.canvas, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    canvasCtx['spectrogram'].setTransform(1, 0, 0, 1, 0, 0);
};

function drawCepstrum() {
    var array =  new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    var binWidth = canvasCtx['cepstrum'].canvas.width/(analyser.frequencyBinCount/2);

    var data = new complex_array.ComplexArray(array.length);
    data.map(function(value, i, n) {
        value.real = array[i];
    })
    data.FFT();
    mag_array = data.magnitude();

    canvasCtx['cepstrum'].clearRect(0, 0, canvasCtx['cepstrum'].canvas.width, canvasCtx['cepstrum'].canvas.height);
    canvasCtx['cepstrum'].fillStyle=make_gradient(canvasCtx['cepstrum']);
    for ( var i = 1; i < (mag_array.length/2); i++ ){
        var value = 20 * Math.log(mag_array[i]) / Math.LN10;

        canvasCtx['cepstrum'].fillRect((i-1)*binWidth,canvasCtx['cepstrum'].canvas.height,binWidth,-value);
    }
};

function make_gradient(ctx){
    var grad = ctx.createLinearGradient(0,0,0,ctx.canvas.height);
    grad.addColorStop(1,'#000000');
    grad.addColorStop(0.85,'#ff0000');
    grad.addColorStop(0.35,'#ffff00');
    grad.addColorStop(0,'#ffffff');
    return grad;
}

function update_graph_heights(){
   percent = 55/num_plots;
   wrappers = document.getElementsByClassName('plot_wrapper');
   for(var i=0; i<wrappers.length; i++) {
      wrappers[i].style.height = percent + 'vh';
   }

   for(var i=0; i<graphs.length; i++) {
      graph = graphs[i];
      if (canvasCtx[graph]) {
          canvas = canvasCtx[graph].canvas;
          canvas.height = canvas.offsetHeight;
      }
   }
   tempCtx.canvas.height = canvasCtx['spectrogram'].canvas.offsetHeight;
}

function remove_parent(e){
   this.parentNode.remove();
   num_plots -= 1;
   update_graph_heights();
   scriptProcs[this.value].onaudioprocess = null;
}

document.addEventListener("DOMContentLoaded", function() {
  init();
}, false);
