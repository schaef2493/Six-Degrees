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
var newMovements = null;
var lastStepPerformed = 0;
var autoExecution = false;
var atHome = false;

// the current mode that the arm is in, so we can tell when to switch
// modes during playback
var currentMode = 0;

// Globals for commands to set modes
var setCartesian = "[0,0,0,[1,0]]";
var setGripper = "[0,0,0,[1,1]]";
var setWrist = "[0,0,0,[0,1]]";

var modeTransitionActive = false;
var transitionMovement = null;
var lastTransitionStepPerformed = 0;

var sampleRate = 10; // ms
var lastMessage = null;
var homeMovement = []; // path to go home

function setArmAutoExecution() {
  if (playbackActive && autoExecution) {
    var message = new ROSLIB.Message({
      data: false
    });

    autoExecution = false;
    setArmAutoExecutionTopic.publish(message);

  } else if (!playbackActive && !autoExecution) {
    var message = new ROSLIB.Message({
      data: true
    });

    autoExecution = true;
    setArmAutoExecutionTopic.publish(message);
  }
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
    homeMovement.push(setCartesian);
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
    homeMovement.push(setGripper);
  }

  // Open gripper
  for (var i=0; i<200; i++) {
    homeMovement.push("[-1,0,0,[0,0]]");
  }

  // Put into cartesian mode
  for (var i=0; i<30; i++) {
    homeMovement.push(setCartesian);
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
    //console.log('Moving arm to ' + axes + ' - ' + buttons);

    var message = new ROSLIB.Message({
      axes: axes,
      buttons: buttons
    });

    joystickWrite.publish(message);
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

  // get the mode that the arm should be in for the next movement
  var necessaryMode = JSON.parse(movements[step])[4];

  if(necessaryMode !== currentMode) {
    switch(necessaryMode) {
      case 0:
        activateMode(null, setCartesian);
        break;
      case 1:
        activateMode(null, setWrist);
        break;
      case 2:
        activateMode(null, setGripper);
        break;
      default:
        console.log("Error: necessaryMode = " + necessaryMode);
        break;   
    }

    currentMode = necessaryMode;
    return;
  }

  moveArm(axes, buttons);
  lastStepPerformed = step;
  atHome = false;

  if (step < movements.length-1) {
    setTimeout(playbackMovement, sampleRate, step+1);
  } else {
    lastStepPerformed = -1;
    moveArm([0,0,0], [0,0]);
    socket.emit('pausePlayback');

    if (arraysEqual(movements, homeMovement)) {
      console.log('Finished moving home');
      socket.emit('movedHome');
      atHome = true;
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

    // after transitioning, if still in middle of playback, we resume playback
    if(movements.length === 0) {
      playbackActive = true;
      playbackMovement(lastStepPerformed);
    }

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
  recordingActive = false;
  lastMessage = null;
});

socket.on('playbackStarted', function (data) {
  playbackActive = true;
  newMovements = data.movements;

  // Continue playback
  if (arraysEqual(movements, newMovements)) {
    playbackMovement(lastStepPerformed + 1);

  // Start playback 
  } else {

    // Only occurs if playback finished and restarted
    if (!atHome) {
      playbackActive = false;
      movements = [];
      socket.emit('finishPlayback');
    } else {
      movements = newMovements;
      playbackMovement();
    }
  }

  setArmAutoExecution();
});

socket.on('playbackPaused', function (data) {
  playbackActive = false;
  moveArm([0,0,0], [0,0]);
});

socket.on('moveToHomePosition', function (data) {
  console.log('Moving home');
  if (!atHome) {
    playbackActive = true;
    movements = homeMovement;
    newMovements = homeMovement;
    playbackMovement();
  }
});

// perform the task of switching modes
function activateMode(data, movementInfo) {
  playbackActive = false;
  setArmAutoExecution();
  atHome = false;
  
  modeTransitionActive = true;
  transitionMovement = [];

  for (var i=0; i<20; i++) {
    transitionMovement.push(movementInfo);
  }

  transitionMode();
}

socket.on('activateCartesian', function (data) {
  console.log('Switching to CARTESIAN');

  activateMode(data, setCartesian);
});

socket.on('activateGripper', function (data) {
  console.log('Switching to GRIPPER');

  activateMode(data, setGripper);

});

socket.on('activateWrist', function (data) {
  console.log('Switching to WRIST');

  activateMode(data, setWrist);

});

setArmAutoExecution();
generateHomeMovement();