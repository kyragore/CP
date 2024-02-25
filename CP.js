window.onload = () => {
    let input = document.getElementById("input")
    let images = document.getElementById("images")


    input.onchange = () => {        
        images.replaceChildren()
        let img = document.createElement("img")

        images.appendChild(img)

        img.src = URL.createObjectURL(input.files[0]);
    }
}

let pic = []; 
let picSize = []; 
let explored = [];
let edges = new Map;
let blackPixels = [];
let vertices = [];

const myImageData = context.createImageData(width, height);

const canvas = document.createElement("canvas");
const context = canvas.getContext("2d");

images.append(canvas);

const frame = context.getImageData(0, 0, w, h);

const grayscale = () => {
    context.drawImage(img, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg; // red
      data[i + 1] = avg; // green
      data[i + 2] = avg; // blue
    }
    context.putImageData(imageData, 0, 0);
  };