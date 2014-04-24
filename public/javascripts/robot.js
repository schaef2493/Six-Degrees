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

// var controlState = new ROSLIB.Topic({
//   ros: ros,
//   name: '/ada/control_state',
//   messageType: 'std_msgs/UInt16'
// });
// 3 = home
// only watch this during home transition. 3 = home, then a bunch of 0 = cartesian

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
var movementsOld = null;
var lastStepPerformed = 0;
var autoExecution = true;
var atHome = false;
var rewindActive = false;

// the current mode that the arm is in, so we can tell when to switch
// modes during playback
var currentMode = 0;
var necessaryMode = 0;

// Globals for commands to set modes
var setCartesian = "[0,0,0,[1,0], 0]";
var setGripper = "[0,0,0,[1,1], 2]";
var setWrist = "[0,0,0,[0,1], 1]";

var modeTransitionActive = false;
var transitionMovement = null;
var lastTransitionStepPerformed = 0;

var sampleRate = 10; // ms
var lastMessage = null;
var homeMovement = []; // path to go home

function setArmAutoExecution() {
  if ((playbackActive || modeTransitionActive) && autoExecution) {
    var message = new ROSLIB.Message({
      data: false
    });

    autoExecution = false;
    //console.log('Setting autoExecution to false');
    setArmAutoExecutionTopic.publish(message);

  } else if (!playbackActive && !modeTransitionActive && !autoExecution) {
    var message = new ROSLIB.Message({
      data: true
    });

    autoExecution = true;
    //console.log('Setting autoExecution to true');
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
  var homeCommand = "[0,0,0,[1,1], 0]";
  var homeMovementWait = "[0,0,0,[0,0], 0]";

  // Move to home
  for (var i=0; i<100; i++) {
    homeMovement.push(homeCommand);
  }

  // Wait
  for (var i=0; i<250; i++) {
    homeMovement.push(homeMovementWait);
  }

  // Open gripper
  for (var i=0; i<150; i++) {
    homeMovement.push("[-1,0,0,[0,0], 2]");
  }

  // Put into cartesian mode
  for (var i=0; i<20; i++) {
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
    console.log('Moving arm to ' + axes + ' - ' + buttons);

    var message = new ROSLIB.Message({
      axes: axes,
      buttons: buttons
    });

    joystickWrite.publish(message);
  }
}

// Begin movement playback
function playbackMovement(step) {
  if (typeof step == 'undefined') {
    step = 0;
  }

  // break if playback was paused
  if (playbackActive == false) {
    moveArm([0,0,0], [0,0]);
    return;
  }

  console.log('Playing back ' + step);

  var axes = (JSON.parse(movements[step])).slice(0,3);
  var buttons = JSON.parse(movements[step])[3];

  // get the mode that the arm should be in for the next movement
  necessaryMode = JSON.parse(movements[step])[4];

  if (necessaryMode != currentMode) {
    currentMode = necessaryMode;
    switch(necessaryMode) {
      case 0:
        console.log("Switching to cartesian");
        activateMode(null, setCartesian);
        break;
      case 1:
        console.log("Switching to wrist");
        activateMode(null, setWrist);
        break;
      case 2:
        console.log("Switching to gripper");
        activateMode(null, setGripper);
        break;
      default:
        console.log("Error: necessaryMode = " + necessaryMode);
        break;   
    }
    
    return;
  }

  // Flip axes values in rewind mode
  if (rewindActive) {
    axes[0] = axes[0] * -1;
    axes[1] = axes[1] * -1;
    axes[2] = axes[2] * -1;
  }

  moveArm(axes, buttons);
  lastStepPerformed = step;
  atHome = false;

  if ((!rewindActive && (step < movements.length-1)) || (rewindActive && (step > 0))) {
    if (rewindActive) {
      setTimeout(playbackMovement, sampleRate, step-1);
    } else {
      setTimeout(playbackMovement, sampleRate, step+1);
    }
  } else {
    lastStepPerformed = -1;
    moveArm([0,0,0], [0,0]);
    socket.emit('pausePlayback');
    setArmAutoExecution();

    if (arraysEqual(movements, homeMovement)) {
      console.log('Finished moving home');
      socket.emit('movedHome');
      atHome = true;
    } else if (!rewindActive) {
      socket.emit('finishPlayback');
      movements = [];
    }
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
    setArmAutoExecution();

    // after transitioning, if still in middle of playback, we resume playback
    if (movements && movements.length != 0) {
      playbackActive = true;
      playbackMovement(lastStepPerformed+1);
    }

  }
}

socket.on('restartPlayback', function (data) {
  console.log('RESTARTING PLAYBACK');
  lastStepPerformed = 0;
});

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
  console.log('Playback started');
  playbackActive = true;
  rewindActive = false;
  newMovements = data.movements;

  // Continue playback
  if (movementsOld && arraysEqual(movementsOld, newMovements)) {
    console.log('RESUMING PLAYBACK');
    movements = movementsOld;
    playbackMovement(lastStepPerformed + 1);

  // Start playback 
  } else {
    console.log("STARTING NEW PLAYBACK");
    if (atHome) {
      movements = newMovements;
      playbackMovement();
    }
  }

  setArmAutoExecution();
});

socket.on('rewindStarted', function (data) {
  console.log('Rewind started');
  playbackActive = true;
  rewindActive = true;
  newMovements = data.movements;

  // Continue playback
  if (movementsOld && arraysEqual(movementsOld, newMovements)) {
    if (lastStepPerformed > 0) {
      movements = movementsOld;
      playbackMovement(lastStepPerformed - 1);
    }
  }

  setArmAutoExecution();
});

socket.on('playbackPaused', function (data) {
  console.log('Playback paused');
  playbackActive = false;
  if (movements && (movements.length > 0)) {
    movementsOld = movements;
  }
  movements = [];
  rewindActive = false;
  moveArm([0,0,0], [0,0]);
});

socket.on('moveToHomePosition', function (data) {
  console.log('Moving home');
  if (!atHome) {
    playbackActive = true;
    setArmAutoExecution();
    movements = homeMovement;
    newMovements = homeMovement;
    playbackMovement();
  } else {
    console.log('Already at home');
    socket.emit('alreadyAtHome');
  }
});

// Perform the task of switching modes
function activateMode(data, movementInfo) {
  moveArm([0,0,0], [0,0]);
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
  currentMode = 0;
  activateMode(data, setCartesian);
});

socket.on('activateGripper', function (data) {
  console.log('Switching to GRIPPER');
  currentMode = 2;
  activateMode(data, setGripper);
});

socket.on('activateWrist', function (data) {
  console.log('Switching to WRIST');
  currentMode = 1;
  activateMode(data, setWrist);
});

setArmAutoExecution();
generateHomeMovement();