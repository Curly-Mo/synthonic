var audioContext = null;
var voices = new Array();
var output;
var envelopes = new Array();
var attack_envelopes =  new Array();

for(var i=0; i<20; i++) {
	var attack_env = new Array();
	var release_env = new Array();
	var attack_time = 1;
	var release_time = 0.5;
	attack_env[0] = 0.0;
	for(var k=1; k<10; k++){
		attack_env[k] = Math.random();
	}
	release_env[0] = attack_env[9];
	for(var k=1; k<9; k++){
		release_env[k] = Math.random();
	}
	release_env[9] = 0.0;

	envelope = new Envelope(attack_env, release_env, attack_time, release_time);
	envelopes[i] = envelope;
}

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
	this.num_harmonics = 20;
	this.frequency = frequencyFromNoteNumber(note);
	this.postGain = audioContext.createGain();
	this.oscillators = new Array();
	this.gain_envs = new Array();

	now = audioContext.currentTime;
	for(var i=0; i<this.num_harmonics; i++) {
		var osc = audioContext.createOscillator();
		osc.frequency.value = this.frequency * (i+1);
		//envelope stuff
		env = audioContext.createGain();
		env.gain.setValueAtTime(0, now);
		envelope = envelopes[i].attack_env;
		for(var e=0; e<envelope.length; e++) {
			time = (envelopes[i].attack_time) * e/(envelope.length-1);
			env.gain.linearRampToValueAtTime(envelope[e], now + time);
		}

		osc.connect(env);
		env.connect(this.postGain);

		this.oscillators[i] = osc;
		this.gain_envs[i] = env;
		osc.start(0);
	}

	this.postGain.connect(output);
	this.postGain.gain.value = velocity * (1 / this.num_harmonics);
}

Voice.prototype.noteOff = function() {
    var now =  audioContext.currentTime;
	console.log("noteoff: now: " + now);

	for(var i=0; i<this.num_harmonics; i++) {
		osc = this.oscillators[i];
		env = this.gain_envs[i];
		env.gain.cancelScheduledValues(now);
		// In case still in attack envelope, scale all values to start at current.
		factor = env.gain.value.toFixed(6) / envelopes[i].release_env[0].toFixed(6);
		if(isNaN(factor)){factor=1;}
		envelope = envelopes[i].release_env;
		for(var e=0; e<envelope.length; e++) {
			time = (envelopes[i].release_time) * e/(envelope.length-1);
			env.gain.linearRampToValueAtTime(envelope[e]*factor, now + time);
		}
		osc.stop(now + parseFloat(time)*2);
	}
}

function initEnvelopes(){
	// forms = document.getElementsByClassName('harmonic_settings');
	// for (form in forms) {
	//
	// }
	envelope = new Envelope([0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9], [0.9,0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.1,0], 1, 1);
	envelopes[0] = envelope;
	for(var i=1; i<20; i++) {
		envelope = new Envelope([0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0], 1, 1);
		envelopes[i] = envelope;
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

function inputChange(e){
	harmonic = parseInt(this.id.substring(1));
	name = e.target.name;
	value = parseFloat(e.target.value);
	updateCSS('input[type="range"]:focus::-webkit-slider-thumb::after', 'content', value);

	if (name=='attack9'){
		release_start = this.getElementsByClassName('envelope')[1].firstElementChild;
		release_start.value = value;
		envelopes[harmonic].release_env[0] = value;
		spacer = this.getElementsByClassName('sustain-spacer')[0];
		spacer.style.height = 88 - (88*value) + 'px';
	}
	if (name=='release0'){
		attack_end = this.getElementsByClassName('envelope')[0].lastElementChild
		attack_end.value = value;
		envelopes[harmonic].attack_env[9] = value;
		spacer = this.getElementsByClassName('sustain-spacer')[0];
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

function initUI(){
	initEnvelopes();
	forms = document.getElementsByClassName('harmonic_settings');
	for (i=0;i<forms.length;i++){
		forms[i].addEventListener('input', inputChange);
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

	initUI();
}

document.addEventListener("DOMContentLoaded", function() {
	initSynth();
}, false);
