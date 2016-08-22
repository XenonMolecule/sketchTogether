//INIT THE CANVAS
var canvas = document.getElementById("drawingCanvas");
var context = canvas.getContext("2d");

//Color Constructor
//ARGS
// name (string) - The name of the color
// hex (string) - The hexadecimal code of the color
function color(name, hex){
    this.name = name || "color";
    this.hex = hex || "FFF";
}

//Init colors
var black = new color("Black","#000"), red = new color("Red","#FF0000"), green = new color("Green","#00FF00"), blue = new color("Blue","#0000FF");
var currentColor = black;

//mouse object for all mouse variables
var mouse = {
    currentX : 0,
    currentY : 0,
    lastX : 0,
    lastY : 0,
    down : false
};

var groupNum;

//When the mouse is pressed on the canvas
$("#drawingCanvas").on("mousemove",function(e){
    mouse.currentX = e.offsetX;
    mouse.currentY = e.offsetY;
    if(mouse.down){
        drawLine(mouse.lastX,mouse.lastY,mouse.currentX,mouse.currentY,currentColor.hex);
    }
    mouse.lastX = e.offsetX;
    mouse.lastY = e.offsetY;
});

//mouse down on canvas
$("#drawingCanvas").on("mousedown",function(e){
    mouse.down = true;
});

//mouse up anywhere
$(document).on("mouseup",function(e){
    mouse.down = false;
});

function drawLine(startX,startY,endX,endY,color){
    if(color==undefined){
        color = black.hex;
    }
    context.beginPath();
    context.strokeStyle = color;
    context.moveTo(startX,startY);
    context.lineTo(endX,endY);
    context.stroke();
    socket.emit('drawLine',{sX:startX,sY:startY,eX:endX,eY:endY,col:color});
}

//attempt to join a group
function sendGroupRequest(groupID){
    socket.emit('reqGroup',groupID);
}

//attempt to create a group
function createGroup(){
    socket.emit('createGroup',true);
}

//Download the current drawing
function download(name){
    var dataUrl = canvas.toDataURL();
    //THANKS @Nippey from this question on stack overflow: http://stackoverflow.com/questions/2793751/how-can-i-create-download-link-in-html
    /* Change MIME type to trick the browser to downlaod the file instead of displaying it */
    dataUrl = dataUrl.replace(/^data:image\/[^;]*/, 'data:application/octet-stream');
    /* In addition to <a>'s "download" attribute, you can define HTTP-style headers */
    dataUrl = dataUrl.replace(/^data:application\/octet-stream/, 'data:application/octet-stream;headers=Content-Disposition%3A%20attachment%3B%20filename="mySketch.png"');
    var link = document.getElementById('downloadLink');
    link.href = dataUrl;
    if(name!=undefined){
        link.download = name+".png";
    }
    link.click();
    link.download = "mySketch.png";
}

////////////////////////////////////////////////////////////////////////////////
//
//                          WEB SOCKET RECIEVING HANDLING
//
////////////////////////////////////////////////////////////////////////////////

//Tell the new group leader that they have the role
socket.on('newLeader',function(data){
   //TODO: Make a better notification!!!
   alert('You are the new leader of this group!');
});

//other group member drew line
socket.on('drawLine',function(data){
    drawLine(data.sX,data.sY,data.eX,data.eY,data.col);
});

//Someone is requesting to join the group
socket.on('reqGroup',function(id){
    //TODO: MAKE A BETTER NOTIFICATION!!!
    if(confirm("Someone wishes to join this group")){
        socket.emit('accGroup',id);
    } else {
        socket.emit('decGroup',id);
    }
});

//alert user that they joined the group
socket.on('accGroup',function(id){
    //TODO: MAKE A BETTER NOTIFICATION!!!
    alert('You are in group ' + id + '!');
    groupNum = id;
    socket.emit('confirmGroup',id);
    socket.emit('reqCanvas',true);
});

//alert user that they were declines access
socket.on('decGroup',function(id){
    //TODO: MAKE A BETTER NOTIFICATION!!!
    alert('Sorry, unfortunately, you were declined access to the group');
})

//Notify user of error of some sort
socket.on('err',function(reason){
    //TODO: MAKE A BETTER NOTIFICATION!!!
    alert("Error: "+reason);
});

//Another user wants the current canvas design
socket.on('reqCanvas',function(userID){
    var dataUrl = canvas.toDataURL();
    socket.emit('sendCanvas',{user:userID,dataURL:dataUrl});
});

//Get the canvas
socket.on('recieveCanvas',function(dataURL){
   var img = document.getElementById('groupCanvas');
   img.src = dataURL;
   context.drawImage(img,0,0);
});