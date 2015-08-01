var audioContext;
var voices = new Array();
var output;
var envelopes = new Array(30);
var presets = {};

function frequencyFromNoteNumber( note ) {
	return 440 * Math.pow(2,(note-69)/12);
}

function noteOn(note, velocity) {
	console.log("note on: " + note + " " + velocity);
	if (voices[note] == null) {
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

function Envelope(attack, release, attackTime, releaseTime){
	this.attack_env = attack;
	this.release_env = release;
	this.attack_time = attackTime;
	this.release_time = releaseTime
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
		var osc = audioContext.createOscillator();
		osc.frequency.value = this.frequency * (i+1);
		//envelope stuff
		var env = audioContext.createGain();
		env.gain.setValueAtTime(0, now);
		var envelope = envelopes[i].attack_env;
		var max = 0;
		for(var e=0; e<envelope.length; e++) {
			time = (envelopes[i].attack_time) * e/(envelope.length-1);
			env.gain.linearRampToValueAtTime(envelope[e], now + time);
			if (envelope[e] > max){
				max = envelope[e];
			}
		}
		this.max_volume += max;

		osc.connect(env);
		env.connect(this.postGain);

		this.oscillators[i] = osc;
		this.gain_envs[i] = env;
		osc.start(0);
	}

	this.postGain.connect(output);
	this.postGain.gain.value = velocity * (1 / this.max_volume);
}

Voice.prototype.noteOff = function() {
    var now =  audioContext.currentTime;
	console.log("noteoff: now: " + now);

	for(var i=0; i<this.num_harmonics; i++) {
		var osc = this.oscillators[i];
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
	var envelope = new Envelope([0,.025,.05,.1,.2,.4,.8,1,1,1], [1,1,1,.8,.4,.2,.1,.05,.025,0], 0.1, 0.1);
	sine_envelopes[0] = envelope;
	for (var k=1; k<sine_envelopes.length; k++) {
		envelope = new Envelope([0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0], 0.1, 0.1);
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
		var envelope = new Envelope(attack, release, 0.1, 0.1);
		square_envelopes[k] = envelope;
	}
	for (var k=1; k<square_envelopes.length; k+=2) {
		var envelope = new Envelope([0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0], 0.1, 0.1);
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
		var envelope = new Envelope(attack, release, 0.1, 0.1);
		triangle_envelopes[k] = envelope;
	}
	for (var k=1; k<triangle_envelopes.length; k+=2) {
		var envelope = new Envelope([0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0], 0.1, 0.1);
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
		var envelope = new Envelope(attack, release, 0.1, 0.1);
		sawtooth_envelopes[k] = envelope;
	}
	return sawtooth_envelopes;
}

function initPresets(){
	presets['sine'] = sinePreset();
	presets['square'] = squarePreset();
	presets['sawtooth'] = sawtoothPreset();
	presets['triangle'] = trianglePreset();

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
	e.preventDefault();
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
			return false;
		}
	}
	opt.text = name;
	opt.value = name;
	select.add(opt);
	select.options.selectedIndex = select.options.length - 1;
	save_button.style.display = 'none';
	presets[name] = envelopes.slice();

	return false;
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
		release_start = form.getElementsByClassName('envelope')[1].firstElementChild;
		release_start.value = value;
		envelopes[harmonic].release_env[0] = value;
		spacer = form.getElementsByClassName('sustain-spacer')[0];
		spacer.style.height = 88 - (88*value) + 'px';
	}
	if (name=='release0'){
		attack_end = form.getElementsByClassName('envelope')[0].lastElementChild
		attack_end.value = value;
		envelopes[harmonic].attack_env[9] = value;
		spacer = form.getElementsByClassName('sustain-spacer')[0];
		spacer.style.height = 88 - (88*value) + 'px';
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
	}
}

function inputChange(e){
	harmonic = parseInt(this.id.substring(1));
	value = parseFloat(e.target.value);
	updateCSS('input[type="range"]:focus::-webkit-slider-thumb::after', 'content', value);

	change(this, e.target);

	document.getElementById('preset').options.selectedIndex = -1;
	document.getElementById('save').style.display = 'inline-block';
}

function initUI(){
	var forms = document.getElementsByClassName('harmonic_settings');
	for (i=0;i<forms.length;i++){
		forms[i].addEventListener('input', inputChange);
	}
	updateEnvelopeUI();

	var tabs = document.getElementsByClassName('harmonics_tab');
	for (i=0;i<tabs.length;i++){
		tabs[i].addEventListener('click', show_harmonics);
	}

	var save_form = document.getElementById('save').form;
	save_form.addEventListener('submit', savePreset);
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
