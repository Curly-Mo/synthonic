var audioContext;
var voices = new Array();
var output;
var envelopes = new Array(30);
var presets = {};

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

function noteOn(note, velocity) {
	if (voices[note] == null) {
		console.log("note on: " + note + " " + velocity);
		// Create a new synth node
		voices[note] = new Voice(note, velocity);
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

function Envelope(harmonic, attack, release, attackTime, releaseTime){
	this.attack_env = attack;
	this.release_env = release;
	this.attack_time = attackTime;
	this.release_time = releaseTime;
	this.harmonic = harmonic;
	this.vibrato = {'frequency': 0, 'amplitude': 0};
	this.tremolo = {'frequency': 0, 'amplitude': 0};
}

function Voice(note, velocity) {
	this.num_harmonics = envelopes.length;
	this.frequency = frequencyFromNoteNumber(note);
	this.postGain = audioContext.createGain();
	this.oscillators = new Array();
	this.gain_envs = new Array();
	this.max_volume = 0;

	now = audioContext.currentTime;
	for(var i=0; i<this.num_harmonics; i++) {
		if (allZeros(envelopes[i].attack_env) && allZeros(envelopes[i].release_env)) {
			continue;
		}
		osc = audioContext.createOscillator();
		osc.frequency.value = this.frequency * envelopes[i].harmonic;
		//envelope stuff
		var env = audioContext.createGain();
		env.gain.setValueAtTime(0, now);
		var envelope = envelopes[i].attack_env;
		// var max = 0;
		for(var e=0; e<envelope.length; e++) {
			time = (envelopes[i].attack_time) * e/(envelope.length-1);
			env.gain.linearRampToValueAtTime(envelope[e], now + time);
			// if (envelope[e] > max){
			// 	max = envelope[e];
			// }
		}
		//this.max_volume += max;

		//vibrato
		if (envelopes[i].vibrato.frequency != 0 && envelopes[i].vibrato.amplitude != 0) {
			var vibrato = audioContext.createOscillator();
			var vibrato_gain = audioContext.createGain();
			vibrato.frequency.value = envelopes[i].vibrato.frequency;
			vibrato_gain.gain.value = envelopes[i].vibrato.amplitude;
			vibrato.connect(vibrato_gain);
			vibrato_gain.connect(osc.frequency);
			vibrato.start(0);
		}

		//tremolo
		if (envelopes[i].tremolo.frequency != 0 && envelopes[i].tremolo.amplitude != 0) {
			var tremolo = audioContext.createOscillator();
			var tremolo_gain = audioContext.createGain();
			var tremolo_output = audioContext.createGain();
			tremolo.frequency.value = envelopes[i].tremolo.frequency;
			tremolo_gain.gain.value = envelopes[i].tremolo.amplitude;
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
		var factor = env.gain.value.toFixed(6) / envelopes[i].release_env[0].toFixed(6);
		if(!isFinite(factor)){factor=1;}
		var envelope = envelopes[i].release_env;
		for(var e=0; e<envelope.length; e++) {
			var time = (envelopes[i].release_time) * e/(envelope.length-1);
			env.gain.linearRampToValueAtTime(envelope[e]*factor, now + time);
		}
		osc.stop(now + parseFloat(time)*2);
	}
}

function sinePreset(){
	var sine_envelopes = new Array(envelopes.length);
	var envelope = new Envelope(1, [0,.025,.05,.1,.2,.4,.8,1,1,1], [1,1,1,.8,.4,.2,.1,.05,.025,0], 0.1, 0.1);
	sine_envelopes[0] = envelope;
	for (var k=1; k<sine_envelopes.length; k++) {
		envelope = new Envelope((k+1), [0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0], 0.1, 0.1);
		sine_envelopes[k] = envelope;
	}
	return sine_envelopes;
}

function squarePreset(){
	var square_envelopes = new Array(envelopes.length);
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
		var envelope = new Envelope((k+1), [0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0], 0.1, 0.1);
		square_envelopes[k] = envelope;
	}
	return square_envelopes;
}

function trianglePreset(){
	var triangle_envelopes = new Array(envelopes.length);
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
		var envelope = new Envelope((k+1), [0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0], 0.1, 0.1);
		triangle_envelopes[k] = envelope;
	}
	return triangle_envelopes;
}

function sawtoothPreset(){
	var sawtooth_envelopes = new Array(envelopes.length);
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
	return sawtooth_envelopes;
}

function bellPreset(){
	var bell_envelopes = new Array(envelopes.length);
	var dur = 1;
	bell_envelopes[0] = new Envelope(1, [0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0], 0.1, 0.1);
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
		var envelope = new Envelope((k+1), [0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0], 0.1, 0.1);
		bell_envelopes[k] = envelope;
	}
	return bell_envelopes;
}

function clarinetPreset(){
	var bell_envelopes = new Array(envelopes.length);
	var dur = 1;
	var amp = 1;
	bell_envelopes[0] = new Envelope(1, logspace(0,amp, 6).concat(logspace(amp, .5*amp, 4)), logspace(.5*amp, 0, 10) , 0.03, .4);
	bell_envelopes[0].tremolo = {'amplitude': 0.1, 'frequency': 0.9};
	bell_envelopes[0].vibrato = {'amplitude': 3.9, 'frequency': 0.1};
	bell_envelopes[1] = new Envelope(3, logspace(0,.75*amp, 6).concat(logspace(.75*amp, .5*.75*amp, 4)), logspace(.5*.75*amp, 0, 10), 0.03, .3);
	bell_envelopes[1].tremolo = {'amplitude': 0.15, 'frequency': 0.8};
	bell_envelopes[1].vibrato = {'amplitude': 4.7, 'frequency': 0.15};
	bell_envelopes[2] = new Envelope(5, logspace(0,.5*amp, 5).concat(logspace(.5*amp, .5*.5*amp, 5)), logspace(.5*.5*amp, 0, 10), 0.03, 0.2);
	bell_envelopes[2].tremolo = {'amplitude': 0.2, 'frequency': 0.4};
	bell_envelopes[2].vibrato = {'amplitude': 2.4, 'frequency': 0.12};
	bell_envelopes[3] = new Envelope(7, logspace(0,.14*amp, 5).concat(logspace(.14*amp, .5*.14*amp, 5)), logspace(.5*.14*amp, 0, 10), 0.04, 0.15);
	bell_envelopes[3].tremolo = {'amplitude': 0.05, 'frequency': 0.5};
	bell_envelopes[3].vibrato = {'amplitude': 3.44, 'frequency': 0.13};
	bell_envelopes[4] = new Envelope(9, logspace(0,.5*amp, 5).concat(logspace(.5*amp, .5*.5*amp, 5)), logspace(.5*.5*amp, 0, 10), 0.04, 0.1);
	bell_envelopes[4].tremolo = {'amplitude': 0.25, 'frequency': 0.2};
	bell_envelopes[4].vibrato = {'amplitude': 3.1, 'frequency': 0.23};
	bell_envelopes[5] = new Envelope(11, logspace(0,.12*amp, 5).concat(logspace(.12*amp, .5*.12*amp, 5)), logspace(.5*.12*amp, 0, 10), 0.05, 0.05);
	bell_envelopes[5].tremolo = {'amplitude': 0.1, 'frequency': 0.6};
	bell_envelopes[5].vibrato = {'amplitude': 2.51, 'frequency': 0.7};
	bell_envelopes[6] = new Envelope(13, logspace(0,.17*amp, 5).concat(logspace(.17*amp, .5*.17*amp, 5)), logspace(.5*.17*amp, 0, 10), 0.05, 0.05);
	bell_envelopes[6].tremolo = {'amplitude': 0.1, 'frequency': 1};
	bell_envelopes[6].vibrato = {'amplitude': 2.9, 'frequency': 0.4};


	for (var k=7; k<bell_envelopes.length; k++) {
		var envelope = new Envelope((k+1), [0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0], 0.1, 0.1);
		bell_envelopes[k] = envelope;
	}
	return bell_envelopes;
}

function initPresets(){
	presets['sine'] = sinePreset();
	presets['square'] = squarePreset();
	presets['sawtooth'] = sawtoothPreset();
	presets['triangle'] = trianglePreset();
	presets['risset bell'] = bellPreset();
	presets['clarinet?'] = clarinetPreset();

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
		envelopes = presets[e.target.value].slice();
		updateEnvelopeUI();
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
	localStorage.setItem(name, JSON.stringify(envelopes));

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
	presets[name] = envelopes.slice();
}

function updateEnvelopeUI(){
	var forms = document.getElementsByClassName('harmonic_settings');
	for(var i=0; i<envelopes.length; i++) {
		var envs = forms[i].getElementsByClassName('envelope');
		var attacks = envs[0].getElementsByTagName('input');
		var releases = envs[1].getElementsByTagName('input');
		for (var j=0;j<attacks.length;j++){
			attacks[j].value = envelopes[i].attack_env[j];
			change(forms[i], attacks[j]);
		}
		for (var j=0;j<releases.length;j++){
			releases[j].value = envelopes[i].release_env[j];
			change(forms[i], releases[j]);
		}
		var attack_env = forms[i].getElementsByClassName('end_time')[0].getElementsByTagName('input')[0];
		var release_env = forms[i].getElementsByClassName('end_time')[1].getElementsByTagName('input')[0];
		attack_env.value = envelopes[i].attack_time;
		release_env.value = envelopes[i].release_time;

		optional_props = forms[i].getElementsByClassName('optional_property');
		for (var j=0;j<optional_props.length;j++) {
			var inputs = optional_props[j].getElementsByTagName('input');
			for (var k=0;k<inputs.length;k++) {
				var prop = inputs[k].getAttribute('data-property');
				var name = inputs[k].name;
				inputs[k].value = envelopes[i][prop][name];
				if (envelopes[i][prop][name] != 0){
					optional_props[j].style.display = 'block';
					optional_props[j].previousElementSibling.getElementsByTagName('input')[0].checked = 'checked';
				}
			}
		}

		forms[i].getElementsByClassName('harmonic_number')[0].value = envelopes[i].harmonic;
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
	var harmonic = form.id.substring(1);
	var name = e.name;
	var value = parseFloat(e.value);

	if (name=='attack9'){
		var release_start = form.getElementsByClassName('envelope')[1].firstElementChild;
		release_start.value = value;
		envelopes[harmonic].release_env[0] = value;
		var sustain = form.getElementsByClassName('sustain-line')[0];
		drawSustainLine(sustain, value);
		//spacer.style.height = 88 - (88*value) + 'px';
	}
	if (name=='release0'){
		attack_end = form.getElementsByClassName('envelope')[0].lastElementChild
		attack_end.value = value;
		envelopes[harmonic].attack_env[9] = value;
		var sustain = form.getElementsByClassName('sustain-line')[0];
		drawSustainLine(sustain, value);
				//spacer.style.height = 88 - (88*value) + 'px';
	}

	if (name=='attack_time'){
		envelopes[harmonic].attack_time = value;
	}else if (name=='release_time'){
		envelopes[harmonic].release_time = value;
	}else if(name.slice(0,-1)=='attack'){
		num = name.slice(-1);
		envelopes[harmonic].attack_env[num] = value;
	}else if(name.slice(0,-1)=='release'){
		num = name.slice(-1);
		envelopes[harmonic].release_env[num] = value;
	}else if(name=='harmonic_number'){
		envelopes[harmonic].harmonic = value;
	}
}

function inputChange(e){
	var harmonic = parseInt(this.id.substring(1));
	var value = parseFloat(e.target.value);
	updateCSS('input[type="range"]:focus::-webkit-slider-thumb::after', 'content', value.toFixed(2));

	change(this, e.target);

	document.getElementById('preset').options.selectedIndex = -1;
	document.getElementById('save').style.display = 'inline-block';
}

function optionalPropChange(e){
	var harmonic = parseInt(e.target.form.id.substring(1));
	var prop = e.target.getAttribute('data-property');
	var name = e.target.name;
	envelopes[harmonic][prop][name] = parseFloat(e.target.value);
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
	   var harmonic = parseInt(e.target.form.id.substring(1));
	   var inputs = div.getElementsByTagName('input');
	   	for (var i=0;i<inputs.length;i++) {
			var prop = inputs[i].getAttribute('data-property');
			var name = inputs[i].name;
			envelopes[harmonic][prop][name] = 0;
	   	}
	}
}

function shapeEnv(e){
	var harmonic = parseInt(e.target.form.id.substring(1));
	var prop = e.target.getAttribute('data-property');
	var env = envelopes[harmonic][prop];
	if (prop == 'attack_env') {
		var last = env.slice(-1)[0];
		if (last == 0) {
			last = 1;
		}
		if (e.target.value == 'linear'){
			envelopes[harmonic][prop] = linspace(0,last, env.length);
		}
		if (e.target.value == 'log'){
			envelopes[harmonic][prop] = logspace(0, last, env.length);
		}
	}else if (prop == 'release_env') {
		var first = env[0];
		if (e.target.value == 'linear'){
			envelopes[harmonic][prop] = linspace(first, 0, env.length);
		}
		if (e.target.value == 'log'){
			envelopes[harmonic][prop] = logspace(first, 0, env.length);
		}
	}
	updateEnvelopeUI();
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
	updateEnvelopeUI();

	var tabs = document.getElementsByClassName('harmonics_tab');
	for (i=0;i<tabs.length;i++){
		tabs[i].addEventListener('click', show_harmonics);
	}

	var save_button = document.getElementById('save');
	save_button.addEventListener('click', savePreset);

	var inputs = document.querySelectorAll('input[type=number]');
	for (i=0;i<inputs.length;i++){
		inputs[i].addEventListener('keypress', function (evt) {
		    if (evt.which < 48 || evt.which > 57){
		        evt.preventDefault();
		    }
		});
	}

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
	envelopes = presets['sine'].slice();
	initUI();
}

document.addEventListener("DOMContentLoaded", function() {
	initSynth();
}, false);
