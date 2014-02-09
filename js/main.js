var up_pressed = false;
var down_pressed = false;
var left_pressed = false;
var right_pressed = false;

var connection = new ros.Connection("ws://hostname:9090");

connection.setOnClose(function (e) {
  console.log('connection closed');
});
connection.setOnError(function (e) {
  console.log('error!');
});
connection.setOnOpen(function (e) {
  console.log('connected to ROS');
});

function print_instruction(pressed,dir,v) {
  if(pressed) {
    console.log("stop " + dir);
  }
  else {
    console.log("start " + dir + " " + v);
  }
}

$(document).ready(function() {

  $('#up').click(function() {
  	print_instruction(up_pressed,"up",1);
    up_pressed = !up_pressed;
  });

  $('#down').click(function() {
  	print_instruction(down_pressed,"down",1);
    down_pressed = !down_pressed;
  });

  $('#left').click(function() {
  	print_instruction(left_pressed,"left",1);
    left_pressed = !left_pressed;
  });

  $('#right').click(function() {
  	print_instruction(right_pressed,"right",1);
    right_pressed = !right_pressed;
  });

});
