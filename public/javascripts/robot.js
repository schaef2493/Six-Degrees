// Connect socket
var socket = io.connect(window.location.hostname);

// Connect to ROS
var ros = new ROSLIB.Ros();

ros.on('error', function(error) {
  console.log(error);
});

ros.on('connection', function() {
  console.log('Connection made!');
});

// Create a connection to rosbridge 
ros.connect('ws://localhost:9090');

// Configure the joystick topic
var joystickWrite = new ROSLIB.Topic({
  ros: ros,
  name: '/ada/joy_control',
  messageType: 'sensor_msgs/Joy'
});

var joystickRead = new ROSLIB.Topic({
  ros: ros,
  name: '/joy',
  messageType: 'sensor_msgs/Joy'
});

var setArmAutoExecutionTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/ada/enableTeleop',
  messageType: 'std_msgs/Bool'
}); 

var recordingActive = false;
var playbackActive = false;
var movements = null;
var lastStepPerformed = 0;

var modeTransitionActive = false;
var transitionMovement = null;
var lastTransitionStepPerformed = 0;

var sampleRate = 10; // ms
var lastMessage = null;
var homeMovement = []; // path to go home

function setArmAutoExecution() {
  if (playbackActive) {
    var message = new ROSLIB.Message({
      data: false
    });
  } else {
    var message = new ROSLIB.Message({
      data: true
    });
  }

  setArmAutoExecutionTopic.publish(message);
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Generates home movement
function generateHomeMovement() {
  var homeCommand = "[0,0,0,[1,1]]";
  var homeMovementWait = "[0,0,0,[0,0]]";

  // Put into cartesian mode
  for (var i=0; i<50; i++) {
    homeMovement.push("[0,0,0,[1,0]]");
  }

  // Move to home
  for (var i=0; i<100; i++) {
    homeMovement.push(homeCommand);
  }

  // Wait
  for (var i=0; i<300; i++) {
    homeMovement.push(homeMovementWait);
  }

  // Put into gripper mode
  for (var i=0; i<30; i++) {
    homeMovement.push("[0,0,0,[1,1]]");
  }

  // Open gripper
  for (var i=0; i<200; i++) {
    homeMovement.push("[-1,0,0,[0,0]]");
  }

  // Put into cartesian mode
  for (var i=0; i<30; i++) {
    homeMovement.push("[0,0,0,[1,0]]");
  }

}

// Send movement to server
function logMovement(data) {
  // console.log('Logging arm at ' + data.axes + ' - ' + data.buttons);
  socket.emit('movement', { axes: data.axes, buttons: data.buttons });
}

// Subscribe to joystick movements
joystickRead.subscribe(function(data) {
    lastMessage = data;
});

// Update movements every 10 ms
function updateMovements() {
  if ((lastMessage != null) && !modeTransitionActive) {
    logMovement(lastMessage);
  }

  setTimeout(updateMovements, sampleRate);
}

// Start update loop
updateMovements();

// Move arm to a position
function moveArm(axes, buttons) {
  if (playbackActive || modeTransitionActive || (arraysEqual(axes,[0,0,0]) && arraysEqual(buttons,[0,0]))) {
    console.log('Moving arm to ' + axes + ' - ' + buttons);

    var message = new ROSLIB.Message({
      axes: axes,
      buttons: buttons
    });

    joystickWrite.publish(message);
  } else {
    console.log("Cancelled movement");
  }
}

// Begin movement playback
function playbackMovement(step) {
  setArmAutoExecution();

  if (typeof step == 'undefined') {
    step = 0;
  }

  // break if playback was paused
  if (playbackActive == false) {
    moveArm([0,0,0], [0,0]);
    return;
  }

  var axes = (JSON.parse(movements[step])).slice(0,3);
  var buttons = JSON.parse(movements[step])[3];
  moveArm(axes, buttons);
  lastStepPerformed = step;

  if (step < movements.length-1) {
    setTimeout(playbackMovement, sampleRate, step+1);
  } else {
    lastStepPerformed = -1;
    moveArm([0,0,0], [0,0]);
    socket.emit('pausePlayback');

    if (arraysEqual(movements, homeMovement)) {
      console.log('Finished moving home');
      socket.emit('movedHome');
    }

    movements = [];
  }
}

function transitionMode(step) {
  setArmAutoExecution();

  if (typeof step == 'undefined') {
    step = 0;
  }

  var axes = (JSON.parse(transitionMovement[step])).slice(0,3);
  var buttons = JSON.parse(transitionMovement[step])[3];
  moveArm(axes, buttons);
  lastTransitionStepPerformed = step;

  if (step < transitionMovement.length-1) {
    setTimeout(transitionMode, sampleRate, step+1);
  } else {
    lastTransitionStepPerformed = 0;
    moveArm([0,0,0], [0,0]);
    modeTransitionActive = false;
  }
}

socket.on('recordingStarted', function (data) {
  console.log('RECORDING STARTED');
  playbackActive = false;
  recordingActive = true;
  lastStepPerformed = 0;
  setArmAutoExecution();
});

socket.on('recordingEnded', function (data) {
  console.log('RECORDING ENDED');
  recordingActive = false;
  lastMessage = null;
});

socket.on('playbackStarted', function (data) {
  console.log('PLAYBACK STARTED');
  playbackActive = true;
  var newMovements = data.movements;

  // Continue playback
  if (arraysEqual(movements, newMovements)) {
    playbackMovement(lastStepPerformed + 1);

  // Start playback 
  } else {
    movements = newMovements;
    playbackMovement();
  }

  setArmAutoExecution();
});

socket.on('playbackPaused', function (data) {
  console.log('PLAYBACK PAUSED');
  playbackActive = false;
  moveArm([0,0,0], [0,0]);
});

socket.on('moveToHomePosition', function (data) {
  console.log('Moving home');
  playbackActive = true;
  movements = homeMovement;
  playbackMovement();
});

socket.on('activateCartesian', function (data) {
  console.log('Switching to CARTESIAN');

  playbackActive = false;
  setArmAutoExecution();
  
  modeTransitionActive = true;
  transitionMovement = [];

  for (var i=0; i<20; i++) {
    transitionMovement.push("[0,0,0,[1,0]]");
  }

  transitionMode();
});

socket.on('activateGripper', function (data) {
  console.log('Switching to GRIPPER');

  playbackActive = false;
  setArmAutoExecution();
  
  modeTransitionActive = true;
  transitionMovement = [];

  for (var i=0; i<20; i++) {
    transitionMovement.push("[0,0,0,[1,1]]");
  }

  transitionMode();
});

socket.on('activateWrist', function (data) {
  console.log('Switching to WRIST');

  playbackActive = false;
  setArmAutoExecution();
  
  modeTransitionActive = true;
  transitionMovement = [];

  for (var i=0; i<20; i++) {
    transitionMovement.push("[0,0,0,[0,1]]");
  }

  transitionMode();
});

setArmAutoExecution();
generateHomeMovement();