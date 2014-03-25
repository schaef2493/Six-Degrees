// connect socket
var socket = io.connect(window.location.hostname);

// connect to ROS
var ros = new ROSLIB.Ros();

ros.on('error', function(error) {
  console.log(error);
});

ros.on('connection', function() {
  console.log('Connection made!');
});

// create a connection to rosbridge 
ros.connect('ws://localhost:9090');

// configure the joystick topic
var joystick = new ROSLIB.Topic({
  ros: ros,
  name: '/joy',
  messageType: 'sensor_msgs/Joy'
});

var recordingActive = false;
var playbackActive = false;
var movements = null;
var lastStepPerformed = 0;
var sampleRate = 10; // ms

function sendMovement(data) {
  socket.emit('movement', { axes: data.axes });
}

var sendMovementThrottled = _.throttle(sendMovement, sampleRate);

joystick.subscribe(function(message) {
  if (recordingActive) {
    sendMovementThrottled(message);
  }
});

function moveArm(axes) {
  console.log('Moving arm to ' + axes);
  
  var message = new ROSLIB.Message({
    axes: axes,
    buttons: [0,0]
  });

  joystick.publish(message);
}

function playbackMovement(step) {
  if (typeof step == 'undefined') {
    step = 0;
  }

  // break if playback was paused
  if (playbackActive == false) {
    return;
  }

  var axes = JSON.parse(movements[step]);
  moveArm(axes);
  lastStepPerformed = step;

  if (step < movements.length-1) {
    setTimeout(playbackMovement, sampleRate, step+1);
  }
}

socket.on('recordingStarted', function (data) {
  recordingActive = true;
});

socket.on('recordingEnded', function (data) {
  recordingActive = false;
});

socket.on('playbackStarted', function (data) {
  playbackActive = true;
  movements = data.movements;
  playbackMovement();
});

socket.on('playbackResumed', function (data) {
  playbackActive = true;
  playbackMovement(lastStepPerformed + 1);
});

socket.on('playbackPaused', function (data) {
  playbackActive = false;
  moveArm([0,0,0]);
});