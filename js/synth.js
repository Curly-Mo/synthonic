var audioContext;
var voices = new Array();
var output;
//var envelopes = new Array(30);
var instrument = new Instrument();
var presets = {};
var noise_buffer;

function frequencyFromNoteNumber( note ) {
	return 440 * Math.pow(2,(note-69)/12);
}

function allZeros(an_array) {
	for (i=0;i<an_array.length;i++) {
		if (an_array[i] !== 0) {
			return false;
		}
	}
	return true;
}

function zeroArray(length) {
	return Array.apply(null, Array(length)).map(Number.prototype.valueOf,0);
}

function filledArray(length, value) {
	return Array.apply(null, Array(length)).map(Number.prototype.valueOf,value);
}

function copyObject(obj){
	return JSON.parse(JSON.stringify(obj));
}

function linspace(a,b,n) {
    if(typeof n === "undefined") n = Math.max(Math.round(b-a)+1,1);
    if(n<2) { return n===1?[a]:[]; }
    var i,ret = Array(n);
    n--;
    for(i=n;i>=0;i--) { ret[i] = (i*b+(n-i)*a)/n; }
    return ret;
}

function logspace(a,b,n) {
	if (a==0) {
		a = -3;
		b = Math.log(b) / Math.LN10;
	}else if (b==0) {
		b = -3;
		a = Math.log(a) / Math.LN10;
	}else{
		a = Math.log(a) / Math.LN10;
		b = Math.log(b) / Math.LN10;
	}

 	return linspace(a,b,n).map(function(x) { return Math.pow(10,x); });
}

function inverse(an_array) {
	var inverted = an_array.slice();
	var max = Math.max.apply(null,inverted);
	for (var i=0;i<inverted.length;i++) {
		inverted[i] = max - inverted[i];
	}
	return inverted.reverse();
}

function greyNoise(min, max, length) {
	var a = max - min;
	var noise = linspace(1, 0, length*3/5);
	noise = noise.concat(linspace(0, 1, length*3/5));
	noise = noise.slice(0,length);
	for (var i=0;i<length;i++){
		noise[i] = noise[i]*noise[i]*a+min
	}
	return noise;
}

function noiseBuffer(length){
    var buffer = audioContext.createBuffer(1, length, audioContext.sampleRate)
    var data = buffer.getChannelData(0);
	for (var i = 0; i < length; i++) {
		data[i] = Math.random()*2 - 1;
	}
	return buffer;
}


function noteOn(note, velocity) {
	if (voices[note] == null) {
		console.log("note on: " + note + " " + velocity);
		// Create a new synth node
		voices[note] = new Voice(instrument, note, velocity);
		var key = document.getElementById( "k" + note );
		if (key)
			key.classList.add("pressed");
	}
}

function noteOff( note ) {
	if (voices[note] != null) {
		// Shut off the note playing and clear it
		voices[note].noteOff();
		voices[note] = null;
		var e = document.getElementById( "k" + note );
		if (e)
			e.classList.remove("pressed");
	}
}

function Instrument(harmonics, noises){
	this.harmonics = harmonics;
	this.noises = noises || [new Envelope()];
}
Instrument.prototype.Copy = function() {
	return new Instrument(this.harmonics, this.noises);
}

function Envelope(harmonic, attack, release, attackTime, releaseTime, vibrato, tremolo, equalizer){
	this.attack_env = attack || zeroArray(10);
	this.release_env = release || zeroArray(10);
	this.attack_time = attackTime || 0.1;
	this.release_time = releaseTime || 0.1;
	this.harmonic = harmonic || 1;
	this.vibrato = vibrato || {'frequency': 0, 'amplitude': 0};
	this.tremolo = tremolo || {'frequency': 0, 'amplitude': 0};
	this.equalizer = equalizer || zeroArray(30);
}
Envelope.prototype.Copy = function() {
	return new Envelope(
		this.harmonic,
		this.attack_env,
		this.release_env,
		this.attack_time,
		this.release_time,
		this.vibrato,
		this.tremolo
	);
}

function Equalizer(num_filters){
	this.filters = new Array(num_filters);
	var band_size = 22500 / (num_filters + 2);
	var filter = audioContext.createBiquadFilter();
	filter.type = 'lowshelf';
	filter.frequency.value = band_size;
	filter.Q.value = 15;
	this.filters[0] = filter;

	filter = audioContext.createBiquadFilter();
	filter.type = 'highshelf';
	filter.frequency.value = band_size * (num_filters);
	filter.Q.value = 15;
	this.filters[num_filters - 1] = filter;

	for (var i=1;i<num_filters-1;i++) {
		filter = audioContext.createBiquadFilter();
		filter.type = 'peaking';
		filter.frequency.value = band_size * (i+1);
		filter.Q.value = 15;
		this.filters[i] = filter;

		this.filters[i-1].connect(this.filters[i]);
	}
	this.filters[num_filters-2].connect(this.filters[num_filters - 1]);

	this.input = this.filters[0];
	this.output = this.filters[num_filters - 1];
}

function Voice(instr, note, velocity) {
	this.instrument = instr;
	this.num_harmonics = instr.harmonics.length;
	this.frequency = frequencyFromNoteNumber(note);
	this.postGain = audioContext.createGain();
	this.oscillators = new Array();
	this.gain_envs = new Array();
	this.noises = new Array();
	this.noise_gain_envs = new Array();
	this.max_volume = 0;

	now = audioContext.currentTime;
	for(var i=0; i<this.num_harmonics; i++) {
		var harmonic = instr.harmonics[i];
		if (allZeros(harmonic.attack_env) && allZeros(harmonic.release_env)) {
			continue;
		}
		var osc = audioContext.createOscillator();
		osc.frequency.value = this.frequency * harmonic.harmonic;
		//envelope stuff
		var env = audioContext.createGain();
		env.gain.setValueAtTime(0, now);
		var envelope = harmonic.attack_env;
		// var max = 0;
		for(var e=0; e<envelope.length; e++) {
			time = (harmonic.attack_time) * e/(envelope.length-1);
			env.gain.linearRampToValueAtTime(envelope[e], now + time);
			// if (envelope[e] > max){
			// 	max = envelope[e];
			// }
		}
		//this.max_volume += max;

		//vibrato
		if (harmonic.vibrato.frequency != 0 && harmonic.vibrato.amplitude != 0) {
			var vibrato = audioContext.createOscillator();
			var vibrato_gain = audioContext.createGain();
			vibrato.frequency.value = harmonic.vibrato.frequency;
			vibrato_gain.gain.value = harmonic.vibrato.amplitude;
			vibrato.connect(vibrato_gain);
			vibrato_gain.connect(osc.frequency);
			vibrato.start(0);
		}

		//tremolo
		if (harmonic.tremolo.frequency != 0 && harmonic.tremolo.amplitude != 0) {
			var tremolo = audioContext.createOscillator();
			var tremolo_gain = audioContext.createGain();
			var tremolo_output = audioContext.createGain();
			tremolo.frequency.value = harmonic.tremolo.frequency;
			tremolo_gain.gain.value = harmonic.tremolo.amplitude;
			tremolo_output.gain.value = 1;
			tremolo.connect(tremolo_gain);
			tremolo_gain.connect(tremolo_output.gain);
			tremolo.start(0);

			osc.connect(tremolo_output);
			tremolo_output.connect(env);
		}else{
			osc.connect(env);
		}


		env.connect(this.postGain);

		this.oscillators[i] = osc;
		this.gain_envs[i] = env;
		osc.start(0);
	}

	for(var i=0; i<instr.noises.length; i++) {
		var noise = instr.noises[i];
		if (allZeros(noise.attack_env) && allZeros(noise.release_env)) {
			continue;
		}
		var node = audioContext.createBufferSource()
		node.buffer = noiseBuffer(audioContext.sampleRate*3);//noise_buffer;
		node.loop = true;

		var env = audioContext.createGain();
		env.gain.setValueAtTime(0, now);
		var envelope = noise.attack_env;
		for(var e=0; e<envelope.length; e++) {
			time = (noise.attack_time) * e/(envelope.length-1);
			env.gain.linearRampToValueAtTime(envelope[e], now + time);
		}

		//vibrato
		if (noise.vibrato.frequency != 0 && noise.vibrato.amplitude != 0) {
			var vibrato = audioContext.createOscillator();
			var vibrato_gain = audioContext.createGain();
			vibrato.frequency.value = noise.vibrato.frequency;
			vibrato_gain.gain.value = noise.vibrato.amplitude;
			vibrato.connect(vibrato_gain);
			vibrato_gain.connect(node.detune);
			vibrato.start(0);
		}

		//tremolo
		if (noise.tremolo.frequency != 0 && noise.tremolo.amplitude != 0) {
			var tremolo = audioContext.createOscillator();
			var tremolo_gain = audioContext.createGain();
			var tremolo_output = audioContext.createGain();
			tremolo.frequency.value = noise.tremolo.frequency;
			tremolo_gain.gain.value = noise.tremolo.amplitude;
			tremolo_output.gain.value = 1;
			tremolo.connect(tremolo_gain);
			tremolo_gain.connect(tremolo_output.gain);
			tremolo.start(0);

			node.connect(tremolo_output);
			tremolo_output.connect(env);
		}else{
			node.connect(env);
		}


		equalizer = new Equalizer(noise.equalizer.length);
		for (var e=0;e<equalizer.filters.length;e++) {
			var filter = equalizer.filters[e];
			filter.gain.value = noise.equalizer[e];
		}
		env.connect(equalizer.input);

		equalizer.output.connect(this.postGain);

		this.noises[i] = node;
		this.noise_gain_envs[i] = env;

		node.start(0);
	}

	this.postGain.connect(output);
	//this.postGain.gain.value = velocity * (1 / this.max_volume);
	this.postGain.gain.value = velocity * (5 / this.num_harmonics);
}

Voice.prototype.noteOff = function() {
    var now =  audioContext.currentTime;
	console.log("noteoff: now: " + now);

	for(var i=0; i<this.num_harmonics; i++) {
		var osc = this.oscillators[i];
		if (osc == null) {
			continue;
		}
		var env = this.gain_envs[i];
		env.gain.cancelScheduledValues(now);
		// In case still in attack envelope, scale all values to start at current.
		var factor = env.gain.value.toFixed(6) / this.instrument.harmonics[i].release_env[0].toFixed(6);
		if(!isFinite(factor)){factor=1;}
		var envelope = this.instrument.harmonics[i].release_env;
		for(var e=0; e<envelope.length; e++) {
			var time = (this.instrument.harmonics[i].release_time) * e/(envelope.length-1);
			env.gain.linearRampToValueAtTime(envelope[e]*factor, now + time);
		}
		osc.stop(now + parseFloat(time)*2);
	}

	for(var i=0; i<this.instrument.noises.length; i++) {
		var noise = this.noises[i];
		if (noise == null) {
			continue;
		}
		var env = this.noise_gain_envs[i];
		env.gain.cancelScheduledValues(now);
		// In case still in attack envelope, scale all values to start at current.
		var factor = env.gain.value.toFixed(6) / this.instrument.noises[i].release_env[0].toFixed(6);
		if(!isFinite(factor)){factor=1;}
		var envelope = this.instrument.noises[i].release_env;
		for(var e=0; e<envelope.length; e++) {
			var time = (this.instrument.noises[i].release_time) * e/(envelope.length-1);
			env.gain.linearRampToValueAtTime(envelope[e]*factor, now + time);
		}
		noise.stop(now + parseFloat(time)*2);
	}
}

function sinePreset(length){
	var sine_envelopes = new Array(length);
	var envelope = new Envelope(1, [0,.025,.05,.1,.2,.4,.8,1,1,1], [1,1,1,.8,.4,.2,.1,.05,.025,0], 0.1, 0.1);
	sine_envelopes[0] = envelope;
	for (var k=1; k<sine_envelopes.length; k++) {
		envelope = new Envelope((k+1), zeroArray(10), zeroArray(10), 0.1, 0.1);
		sine_envelopes[k] = envelope;
	}
	var inst = new Instrument(sine_envelopes);
	return inst;
}

function squarePreset(length){
	var square_envelopes = new Array(length);
	for (var k=0; k<square_envelopes.length; k+=2) {
		var attack = [0,.025,.05,.1,.2,.4,.8,1,1,1];
		var release = [1,1,1,.8,.4,.2,.1,.05,.025,0];
		for (var i=0;i<attack.length;i++){
			attack[i] = attack[i] * 1/(k+1);
			release[i] = release[i] * 1/(k+1);
		}
		var envelope = new Envelope((k+1), attack, release, 0.1, 0.1);
		square_envelopes[k] = envelope;
	}
	for (var k=1; k<square_envelopes.length; k+=2) {
		var envelope = new Envelope((k+1), zeroArray(10), zeroArray(10), 0.1, 0.1);
		square_envelopes[k] = envelope;
	}
	var inst = new Instrument(square_envelopes);
	return inst;
}

function trianglePreset(length){
	var triangle_envelopes = new Array(length);
	for (var k=0; k<triangle_envelopes.length; k+=2) {
		var attack = [0,.025,.05,.1,.2,.4,.8,1,1,1];
		var release = [1,1,1,.8,.4,.2,.1,.05,.025,0];
		for (var i=0;i<attack.length;i++){
			attack[i] = attack[i] * 1/(Math.pow(k+1,2));
			release[i] = release[i] * 1/(Math.pow(k+1,2));
		}
		var envelope = new Envelope((k+1), attack, release, 0.1, 0.1);
		triangle_envelopes[k] = envelope;
	}
	for (var k=1; k<triangle_envelopes.length; k+=2) {
		var envelope = new Envelope((k+1), zeroArray(10), zeroArray(10), 0.1, 0.1);
		triangle_envelopes[k] = envelope;
	}
	var inst = new Instrument(triangle_envelopes);
	return inst;
}

function sawtoothPreset(length){
	var sawtooth_envelopes = new Array(length);
	for (var k=0; k<sawtooth_envelopes.length; k++) {
		var attack = [0,.025,.05,.1,.2,.4,.8,1,1,1];
		var release = [1,1,1,.8,.4,.2,.1,.05,.025,0];
		for (var i=0;i<attack.length;i++){
			attack[i] = attack[i] * 1/(k+1);
			release[i] = release[i] * 1/(k+1);
		}
		var envelope = new Envelope((k+1), attack, release, 0.1, 0.1);
		sawtooth_envelopes[k] = envelope;
	}
	var inst = new Instrument(sawtooth_envelopes);
	return inst;
}

function bellPreset(length){
	var bell_envelopes = new Array(length);
	var dur = 1;
	bell_envelopes[0] = new Envelope(1, zeroArray(10), zeroArray(10), 0.1, 0.1);
	bell_envelopes[1] = new Envelope(0.56, linspace(0,0.374, 10), linspace(0.374, 0, 10), 0.1*1*dur, 1*dur);
	bell_envelopes[2] = new Envelope(0.56, linspace(0,0.251, 10), linspace(0.251, 0, 10), 0.1*0.9*dur, 0.9*dur);
	bell_envelopes[3] = new Envelope(0.92, linspace(0,0.374, 10), linspace(0.374, 0, 10), 0.1*0.65*dur, 0.65*dur);
	bell_envelopes[4] = new Envelope(0.93, linspace(0,0.674, 10), linspace(0.674, 0, 10), 0.1*0.55*dur, 0.55*dur);
	bell_envelopes[5] = new Envelope(1.19, linspace(0,1, 10), linspace(1, 0, 10), 0.1*0.325*dur, 0.325*dur);
	bell_envelopes[6] = new Envelope(1.7, linspace(0,0.625, 10), linspace(0.625, 0, 10), 0.1*0.35*dur, 0.35*dur);
	bell_envelopes[7] = new Envelope(2, linspace(0,0.546, 10), linspace(0.546, 0, 10), 0.1*0.25*dur, 0.25*dur);
	bell_envelopes[8] = new Envelope(2.74, linspace(0,0.498, 10), linspace(0.498, 0, 10), 0.1*0.2*dur, 0.2*dur);
	bell_envelopes[9] = new Envelope(3, linspace(0,0.498, 10), linspace(0.498, 0, 10), 0.1*0.15*dur, 0.15*dur);
	bell_envelopes[10] = new Envelope(3.76, linspace(0,0.374, 10), linspace(0.374, 0, 10), 0.1*0.1*dur, 0.1*dur);
	bell_envelopes[11] = new Envelope(3.76, linspace(0,0.498, 10), linspace(0.498, 0, 10), 0.1*0.075*dur, 0.075*dur);
	for (var k=12; k<bell_envelopes.length; k++) {
		var envelope = new Envelope((k+1), zeroArray(10), zeroArray(10), 0.1, 0.1);
		bell_envelopes[k] = envelope;
	}
	var inst = new Instrument(bell_envelopes);
	return inst;
}

function clarinetPreset(length){
	var bell_envelopes = new Array(length);
	var dur = 1;
	var amp = 1;
	bell_envelopes[0] = new Envelope(1, logspace(0,amp, 6).concat(
		logspace(amp, .5*amp, 4)), linspace(.5*amp, 0, 10) , 0.06, .35);
	bell_envelopes[0].tremolo = {'amplitude': 0.1, 'frequency': 0.9};
	bell_envelopes[0].vibrato = {'amplitude': 3.9, 'frequency': 0.1};
	bell_envelopes[1] = new Envelope(3, logspace(0,.75*amp, 6).concat(
		logspace(.75*amp, .5*.75*amp, 4)), linspace(.5*.75*amp, 0, 10), 0.06, .25);
	bell_envelopes[1].tremolo = {'amplitude': 0.15, 'frequency': 0.8};
	bell_envelopes[1].vibrato = {'amplitude': 4.7, 'frequency': 0.15};
	bell_envelopes[2] = new Envelope(5, logspace(0,.5*amp, 5).concat(
		logspace(.5*amp, .5*.5*amp, 5)), linspace(.5*.5*amp, 0, 10), 0.06, 0.18);
	bell_envelopes[2].tremolo = {'amplitude': 0.2, 'frequency': 0.4};
	bell_envelopes[2].vibrato = {'amplitude': 2.4, 'frequency': 0.12};
	bell_envelopes[3] = new Envelope(7, logspace(0,.14*amp, 5).concat(
		logspace(.14*amp, .5*.14*amp, 5)), linspace(.5*.14*amp, 0, 10), 0.08, 0.13);
	bell_envelopes[3].tremolo = {'amplitude': 0.05, 'frequency': 0.5};
	bell_envelopes[3].vibrato = {'amplitude': 3.44, 'frequency': 0.13};
	bell_envelopes[4] = new Envelope(9, logspace(0,.5*amp, 5).concat(
		logspace(.5*amp, .5*.5*amp, 5)), linspace(.5*.5*amp, 0, 10), 0.08, 0.09);
	bell_envelopes[4].tremolo = {'amplitude': 0.25, 'frequency': 0.2};
	bell_envelopes[4].vibrato = {'amplitude': 3.1, 'frequency': 0.23};
	bell_envelopes[5] = new Envelope(11, logspace(0,.12*amp, 5).concat(
		logspace(.12*amp, .5*.12*amp, 5)), linspace(.5*.12*amp, 0, 10), 0.1, 0.05);
	bell_envelopes[5].tremolo = {'amplitude': 0.1, 'frequency': 0.6};
	bell_envelopes[5].vibrato = {'amplitude': 2.51, 'frequency': 0.7};
	bell_envelopes[6] = new Envelope(13, logspace(0,.03*amp, 5).concat(
		logspace(.03*amp, .5*.03*amp, 5)), linspace(.5*.03*amp, 0, 10), 0.01, 0.05);
	bell_envelopes[6].tremolo = {'amplitude': 0.1, 'frequency': 1};
	bell_envelopes[6].vibrato = {'amplitude': 2.9, 'frequency': 0.4};


	for (var k=7; k<bell_envelopes.length; k++) {
		var envelope = new Envelope((k+1), zeroArray(10), zeroArray(10), 0.1, 0.1);
		bell_envelopes[k] = envelope;
	}

	var noise = new Array(1);
	noise[0] = new Envelope(1, linspace(0,.1, 3).concat(
		linspace(.1, .04, 3)).concat(linspace(.05, 0.02, 4)),
		linspace(0.02, 0, 10), 0.2, 0.05);
	noise[0].equalizer = filledArray(30, -40);
	noise[0].equalizer[0] = 2;
	noise[0].equalizer[1] = -10;

	var inst = new Instrument(bell_envelopes, noise);
	return inst;
}

function initPresets(){
	var length = 30;
	presets['sine'] = sinePreset(length).Copy();
	presets['square'] = squarePreset(length).Copy();
	presets['sawtooth'] = sawtoothPreset(length).Copy();
	presets['triangle'] = trianglePreset(length).Copy();
	presets['risset bell'] = bellPreset(length).Copy();
	presets['clarinet?'] = clarinetPreset(length).Copy();

	//Load saved presets
	for (var i=0;i<localStorage.length;i++) {
		var key = localStorage.key(i);
  		console.log('Loading custom preset: ' + key);
		presets[key] = JSON.parse(localStorage.getItem(key));
	}

	// Add presets to dropdown
	var select = document.getElementById('preset');
	for (key in presets) {
		var opt = document.createElement("option");
		opt.text = key;
		opt.value = key;
		select.add(opt);
	}
	select.addEventListener('change', function(e){
		instrument = presets[e.target.value];
		updateUI();
	});
}

function savePreset(e){
	var save_button = document.getElementById('save');
	if (save_button.style.display == 'none') {
		return false;
	}
	var name = prompt("Save Instrument as:");
	if(name==null||name==''){
		return false;
	}
	localStorage.setItem(name, JSON.stringify(instrument));

	// Add preset to dropdown
	var select = document.getElementById('preset');
	var opt = document.createElement("option");
	for (var i=0;i<select.options.length;i++) {
		if(select.options[i].value == name){
			select.options.selectedIndex = i;
			save_button.style.display = 'none';
			return;
		}
	}
	opt.text = name;
	opt.value = name;
	select.add(opt);
	select.options.selectedIndex = select.options.length - 1;
	save_button.style.display = 'none';
	presets[name] = instrument;
}

function updateUI(){
	updateEnvelopeUI('harmonics');
	updateEnvelopeUI('noises');
}

function updateEnvelopeUI(type){
	var forms = document.getElementsByClassName(type);
	for(var i=0; i<instrument[type].length; i++) {
		var envs = forms[i].getElementsByClassName('envelope');
		var attacks = envs[0].getElementsByTagName('input');
		var releases = envs[1].getElementsByTagName('input');
		for (var e=0;e<envs.length;e++) {
			var env_name = envs[e].getAttribute('data-property');
			var env = envs[e].getElementsByTagName('input');

			for (var j=0;j<env.length;j++){
				env[j].value = instrument[type][i][env_name][j];
				change(forms[i], env[j]);
			}
		}

		var attack_time = forms[i].getElementsByClassName('end_time')[0].getElementsByTagName('input')[0];
		var release_time = forms[i].getElementsByClassName('end_time')[1].getElementsByTagName('input')[0];
		attack_time.value = instrument[type][i].attack_time;
		release_time.value = instrument[type][i].release_time;

		optional_props = forms[i].getElementsByClassName('optional_property');
		for (var j=0;j<optional_props.length;j++) {
			var inputs = optional_props[j].getElementsByTagName('input');
			for (var k=0;k<inputs.length;k++) {
				var prop = inputs[k].getAttribute('data-property');
				var name = inputs[k].name;
				inputs[k].value = instrument[type][i][prop][name];
				if (instrument[type][i][prop][name] != 0){
					optional_props[j].style.display = 'block';
					optional_props[j].previousElementSibling.getElementsByTagName('input')[0].checked = 'checked';
				}
			}
		}

		forms[i].getElementsByClassName('harmonic_number')[0].value = instrument[type][i].harmonic;
	}
}

function show_harmonics(e){
	var siblings = e.target.parentNode.children;
	for (var i=0;i<siblings.length;i++) {
		siblings[i].className = siblings[i].className.replace('current', '');
	}
	e.target.className = (e.target.className + ' current').trim();

	var values = e.target.innerText.split('-');
	var start = values[0];
	var end = values[1];

	var harmonics = document.getElementsByClassName('harmonic_settings');
	for (var i=0;i<harmonics.length;i++) {
		if (i >= start && i <= end){
			harmonics[i].style.display = 'block';
		}else{
			harmonics[i].style.display = 'none';
		}
	}

	if (e.target.innerText == 'noise') {
		var noises = document.getElementsByClassName('noises');
		for (var i=0;i<noises.length;i++) {
			noises[i].style.display = 'block';
		}
	}
}

function updateCSS(selector, property, value){
	var sheets = document.styleSheets;
	for (var s=0; s<sheets.length; s++){
		var rules = sheets[s].cssRules;
		for (var r=0; r<rules.length; r++){
			var rule = rules[r];
			if (selector == rule.selectorText){
				var pattern = new RegExp(property+'(.*);', 'gm');
				if (rule.cssText.match(pattern)){
					newrule = rule.cssText.replace(pattern, property+': "'+ value+'";');
					sheets[s].deleteRule(r);
					sheets[s].insertRule(newrule, r);
					return;
				}
			}
		}
	}
}

function change(form, e){
	var harmonic = form.getAttribute('data-harmonic');
	var type = form.getAttribute('data-type')
	var name = e.name;
	var value = parseFloat(e.value);

	if (name=='attack9'){
		var release_start = form.getElementsByClassName('envelope')[1].firstElementChild;
		release_start.value = value;
		instrument[type][harmonic].release_env[0] = value;
		var sustain = form.getElementsByClassName('sustain-line')[0];
		drawSustainLine(sustain, value);
		//spacer.style.height = 88 - (88*value) + 'px';
	}
	if (name=='release0'){
		attack_end = form.getElementsByClassName('envelope')[0].lastElementChild
		attack_end.value = value;
		instrument[type][harmonic].attack_env[9] = value;
		var sustain = form.getElementsByClassName('sustain-line')[0];
		drawSustainLine(sustain, value);
				//spacer.style.height = 88 - (88*value) + 'px';
	}

	if (name=='attack_time'){
		instrument[type][harmonic].attack_time = value;
	}else if (name=='release_time'){
		instrument[type][harmonic].release_time = value;
	}else if(name.slice(0,-1)=='attack'){
		num = name.slice(-1);
		instrument[type][harmonic].attack_env[num] = value;
	}else if(name.slice(0,-1)=='release'){
		num = name.slice(-1);
		instrument[type][harmonic].release_env[num] = value;
	}else if(name=='harmonic_number'){
		instrument[type][harmonic].harmonic = value;
	}else if(name.replace(/[0-9]/g, '')=='spectrum'){
		var num = name.replace(/\D/g,'');
		instrument[type][harmonic].equalizer[num] = value;
	}
}

function inputChange(e){
	//var harmonic = parseInt(this.getAttribute('data-harmonic'));
	var value = parseFloat(e.target.value);
	updateCSS('input[type="range"]:focus::-webkit-slider-thumb::after', 'content', value.toFixed(2));

	change(this, e.target);

	document.getElementById('preset').options.selectedIndex = -1;
	document.getElementById('save').style.display = 'inline-block';
}

function optionalPropChange(e){
	var harmonic = parseInt(e.target.form.getAttribute('data-harmonic'));
	var type = e.target.form.getAttribute('data-type')
	var prop = e.target.getAttribute('data-property');
	var name = e.target.name;
	instrument[type][harmonic][prop][name] = parseFloat(e.target.value);
}

function checkboxChange(e){
	var div = e.target.nextElementSibling;
	if (div == null) {
		div = e.target.parentNode.nextElementSibling;
	}
	if (e.target.checked){
	   div.style.display = 'block';
	   var inputs = div.getElementsByTagName('input');
	   for (var i=0;i<inputs.length;i++) {
		   var event = {'target': inputs[i]};
		   optionalPropChange(event);
	   }
	}else{
	   div.style.display = 'none';
	   var harmonic = parseInt(e.target.form.getAttribute('data-harmonic'));
	   var inputs = div.getElementsByTagName('input');
	   for (var i=0;i<inputs.length;i++) {
		   var prop = inputs[i].getAttribute('data-property');
		   var type = inputs[i].getAttribute('data-type');
		   var name = inputs[i].name;
		   instrument[type][harmonic][prop][name] = 0;
	   }
	}
}

function shapeEnv(e){
	var harmonic = parseInt(e.target.form.getAttribute('data-harmonic'));
	var prop = e.target.getAttribute('data-property');
	var type = e.target.getAttribute('data-type');
	var env = instrument[type][harmonic][prop];
	if (prop == 'attack_env') {
		var last = env.slice(-1)[0];
		if (last == 0) {
			last = 1;
		}
		if (e.target.value == 'linear'){
			instrument[type][harmonic][prop] = linspace(0,last, env.length);
		}
		if (e.target.value == 'log'){
			instrument[type][harmonic][prop] = logspace(0, last, env.length);
		}
		if (e.target.value == 'inv'){
			instrument[type][harmonic][prop] = inverse(instrument[type][harmonic][prop]);
		}
		if (e.target.value == 'zero'){
			instrument[type][harmonic][prop] = zeroArray(10);
		}
	}else if (prop == 'release_env') {
		var first = env[0];
		if (e.target.value == 'linear'){
			instrument[type][harmonic][prop] = linspace(first, 0, env.length);
		}
		if (e.target.value == 'log'){
			instrument[type][harmonic][prop] = logspace(first, 0, env.length);
		}
		if (e.target.value == 'inv'){
			instrument[type][harmonic][prop] = inverse(instrument[type][harmonic][prop]);
		}
		if (e.target.value == 'zero'){
			instrument[type][harmonic][prop] = zeroArray(10);
		}
	}else if (prop == 'equalizer') {
		if (e.target.value == 'white'){
			instrument[type][harmonic][prop] = zeroArray(instrument[type][harmonic][prop].length);
		}
		if (e.target.value == 'pink'){
			instrument[type][harmonic][prop] = linspace(5, -20, instrument[type][harmonic][prop].length);
		}
		if (e.target.value == 'brown'){
			instrument[type][harmonic][prop] = linspace(5, -40, instrument[type][harmonic][prop].length);
		}
		if (e.target.value == 'grey'){
			instrument[type][harmonic][prop] = greyNoise(-30, 0, instrument[type][harmonic][prop].length);
		}
		if (e.target.value == 'silence'){
			instrument[type][harmonic][prop] = filledArray(instrument[type][harmonic][prop].length, -50);
		}
	}
	updateUI();
}

function drawSustainLine(canvas, height) {
	if (canvas.getContext){
		var ctx = canvas.getContext('2d');
		height = canvas.height * height;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.lineWidth = 5;
		ctx.lineCap = 'round';
		ctx.strokeStyle = 'rgb(255, 255, 255)';
	    var path = new Path2D();
		path.moveTo(0 + 10, canvas.height - height);
	    path.lineTo(canvas.width - 15, canvas.height - height);
	    ctx.stroke(path);
  	}
}

function initUI(){
	var forms = document.getElementsByClassName('harmonic_settings');
	for (i=0;i<forms.length;i++){
		forms[i].addEventListener('input', inputChange);
		forms[i].addEventListener('focus', inputChange, true);
	}
	updateUI();

	var tabs = document.getElementsByClassName('harmonics_tab');
	for (i=0;i<tabs.length;i++){
		tabs[i].addEventListener('click', show_harmonics);
	}

	var save_button = document.getElementById('save');
	save_button.addEventListener('click', savePreset);

	// var inputs = document.querySelectorAll('input[type=number]');
	// for (i=0;i<inputs.length;i++){
	// 	inputs[i].addEventListener('blur', function (e) {
	// 	    e.target.value = e.target.value.replace(/\D/g,'');;
	// 	});
	// }

	var checkboxes = document.getElementsByClassName('checkbox');
	for (i=0;i<checkboxes.length;i++){
		checkboxes[i].addEventListener('change', checkboxChange);
	}

	var optional_properties = document.getElementsByClassName('optional_property');
	for (i=0;i<optional_properties.length;i++){
		optional_properties[i].addEventListener('input', optionalPropChange);
	}

	var env_shapers = document.getElementsByClassName('env_shaper');
	for (i=0;i<env_shapers.length;i++){
		env_shapers[i].addEventListener('click', shapeEnv);
	}
}

function initSynth() {
	window.AudioContext = window.AudioContext || window.webkitAudioContext;
	try {
		if (typeof audioContext == 'undefined' || audioContext == null){
            audioContext = new AudioContext();
		}
	}catch(e) {
    	alert('The Web Audio API is not supported in this browser.');
  	}
	output = audioContext.createGain();
	output.connect(audioContext.destination);

	initPresets();
	instrument = presets['sine'].Copy();
	initUI();

	noise_buffer = noiseBuffer(audioContext.sampleRate*3);
}

document.addEventListener("DOMContentLoaded", function() {
	initSynth();
}, false);
