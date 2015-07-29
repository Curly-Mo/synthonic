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
	this.attack_envelope = attack;
	this.release_envelope = release;
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
		envelope = envelopes[i].attack_envelope;
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
		factor = env.gain.value.toFixed(6) / envelopes[i].release_envelope[0].toFixed(6);
		envelope = envelopes[i].release_envelope;
		for(var e=0; e<envelope.length; e++) {
			time = (envelopes[i].release_time) * e/(envelope.length-1);
			env.gain.linearRampToValueAtTime(envelope[e]*factor, now + time);
		}
		osc.stop(now + parseFloat(time)*2);
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
}

document.addEventListener("DOMContentLoaded", function() {
	initSynth();
}, false);
