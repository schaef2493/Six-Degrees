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

// Configure the joystick topic
var joystick = new ROSLIB.Topic({
  ros: ros,
  name: '/joy',
  messageType: 'sensor_msgs/Joy'
});

// var message = new ROSLIB.Message({
//   linear : {
//     x : 0.0,
//     y : 0.0,
//     z : 0.5
//   },
//   angular : {
//     x : 0.0,
//     y : 0.0,
//     z : 0.0
//   }
// });

//joystick.publish(message);

joystick.subscribe(function(message) {
  console.log('Received message on ' + listener.name + ': ' + message.data);
});


// configure ROS services
// TODO: How to format this block?
// var startRecordingService = new ROSLIB.Service({
//   ros: ros,
//   name: '/ada/startTeach',
//   serviceType: 'Laura will give us this'
// });

// var pauseRecordingService = new ROSLIB.Service({
//   ros: ros,
//   name: '/ada/stopTeach',
//   serviceType: 'Laura will give us this'
// });

// var startPlaybackService = new ROSLIB.Service({
//   ros: ros,
//   name: '/ada/play',
//   serviceType: 'Laura will give us this'
// });

// // TODO: How to pass file to this service request?
// function startRecording(name) {
//   var request = new ROSLIB.ServiceRequest({
//     filename: name,
//   });

//   console.log('Starting recording of ' + name);

//   startRecordingService.callService(request, function(result) {
//     console.log(result);
//   });
// }

// function pauseRecording() {
//   var request = new ROSLIB.ServiceRequest();

//   console.log('Stopping recording');
  
//   pauseRecordingService.callService(request, function(result) {
//     console.log(result);
//   });
// }

// function startPlayback(name) {
//   var request = new ROSLIB.ServiceRequest({
//     filename: name,
//   });

//   console.log('Starting playback of ' + name);

//   startPlaybackService.callService(request, function(result) {
//     console.log(result);
//   });
// }

// function pausePlayback() {
//   // TODO: Implement this ROS service
//   console.log('Pause playback not implemented');
// }

// // Socket connections
// socket.on('startRecording', function (data) {
//   startRecording(data.task);
// });

// socket.on('pauseRecording', function (data) {
//   pauseRecording();
// });

// socket.on('startPlayback', function (data) {
//   startPlayback(data.task);
// });

// socket.on('pausePlayback', function (data) {
//   pausePlayback();
// });