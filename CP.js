window.onload = () => {
    const input = document.getElementById("input")
    const images = document.getElementById("images")


    input.onchange = () => {        
        images.replaceChildren()
        const img = document.createElement("img")
        images.append(img)
        image.onload = () => {
          processAndLoopImage(img);
        };
        img.src = URL.createObjectURL(input.files[0]);
    };

    const process_button = document.getElementById("process");
    process_button.onclick = () => {
      const input_thres = document.getElementById("threshold").value;
      check(input_thres)
      const pic = process_img(input.files[0]); // Process the image
      const { vertices, explored } = process_img(input.files[0]);
      const verticesSet = new Set(vertices);
      const vertex_faces = check(pic, explored, vertices); // check which black pixels can be vertices
      //const vertexCount = countVertices(verticesSet, vertex_faces); // count number of vertices
      show(images, vertices); // shows vertices in red
      connect(vertices, vertex_faces); // Connect vertices with faces
      shrink(vertices); // Shrink vertices
      show_vertices(images, vertices); // Show vertices on the image
    };

    const find_thres = document.getElementById("find");
    find_thres.onclick = () => {
      let thres = 1;
      let allVertices = [0];
      let same = 1;
      while (thres < 30 && same < 3) {
        check(thres);
        allVertices.push(countVertices());
        console.log(allVertices);
        if (allVertices[thres] == allVertices[thres-1]) {
          same += 1;
          thres += 1;
          continue;
        };
        same = 1;
        thres += 1;
      };
      show(images, vertices);
      connect(vertices, vertex_faces);
      //connect2();
      shrink(vertices);
      evaluate();
      show_vertices(images, vertices);
  };

};

let pic = []; // stores all pixel values of image
let size = []; // stores size of image for easy ref
let explored = []; // internal representation of image, updates the faces of white pixels
let blackPixels = []; // array of all black pixels stored in [row, col]
let vertices = []; // array of vertex coordinates
let verticesSet = new Set; // same as vertices but in Set datastructure
let thres_vertices = [];
let graph = new Map; // key: vertex number; value: faces surrounding it


const process_image = (img, images) => {
  pic = [];
  explored = [];
  blackPixels = [];

  const w = 400;
  const h = Math.floor(w*img.height/img.width);
  size = [w+10, h+10];
  explored = Array(h+10).fill().map(() => Array(w+10).fill(false));

  const canvas = document.createElement("canvas");
  images.append(canvas);
  
  // set styles of img and canvas
  img.width = w;
  img.height = h;
  img.style.margin = "2px";
  canvas.width = w + 10;
  canvas.height = h + 10;
  canvas.style.margin = "2px";

  const context = canvas.getContext("2d");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(img, 5, 5, w, h);

  const frame = context.getImageData(0, 0, w+10, h+10);
  const data = frame.data;
  canvas.setAttribute("id", "original");

  for (let y = 0; y < (h+10); ++y) {
    pic[y] = [];
    for (let x = 0; x < (w+10); ++x) {
        // turns the image into black and white (not greyscale)
        const i = ((w+10)*y + x) << 2;
        const [r, g, b, a] = [0, 1, 2, 3].map(j => data[i + j]);
        //changes to white if avg is more than 200 
        const v = (Math.floor((r + g + b)/3) > 170) ? 255 : 0;
        
        const color = [v, v, v, 255];
        color.forEach((c, j) => data[i + j] = c);
        pic[y].push(v); //add pixel to data array
        
    };
  };

//255 white, 0 black
context.putImageData(frame, 0, 0);
}

let faces = new Map; //

const loopImage = () => {
  faces.clear();
  let n = 0; // number of white regions
  let pixel = 0;
                
  while (pixel < (size[0]*size[1])) {
    let row = Math.floor(pixel / size[0]);
    let col = pixel % size[0]; 

    if (explored[row][col] != false) {
      pixel += 1;
      continue
    };

    // white pixel
    if (pic[row][col] == 255) {
      flood(row, col, n);
      if (faces.get(n).length < 10) { //get rid of stray cases with less than 10 px in face
        faces.delete(n)
        continue;
      };

      n += 1;
      pixel += 1;
      continue;
    };

    // black pixel
    explored[row][col] = true;
    blackPixels.push([row, col]);
    pixel += 1;
  };
};


const flood = (r, c, n) => {
  let queue = [[r, c]];
  let i = 0;
  faces.set(n, [`${r}c${c}`]);
  explored[r][c] = `f${n}`;

  while (i < queue.length) {
    // get pixel from queue
    let row = queue[i][0];
    let col = queue[i][1];
    i += 1;

    //CHANGE BELOW LINE
    let neighbours = [[-1, 0], [0, -1], [0, 1], [1, 0]];
    for (const pixel of neighbours) {
      // extract out the neighbour pixel coords
      let xn = pixel[0] + row;
      let yn = pixel[1] + col;

      // checks if neighbouring pixel exists
      if (xn < 0 || xn > size[1]-1 || yn < 0 || yn > size[0]-1) {continue};

      // skip if pixel was explored (also in queue alr)
      if (explored[xn][yn] != false) {continue};

      if (pic[xn][yn] == 255) { // if pixel is white + not in queue/explored --> push to queue
        faces.get(n).push(`${xn}c${yn}`);
        queue.push([xn, yn]);
        explored[xn][yn] = `f${n}`
        continue;
      };
      
      blackPixels.push([xn, yn]);
      explored[xn][yn] = true;
    };
    //console.log(explored);
  };
  console.log(`done with face ${n}`);
  return(faces);
  
};

let vertex_faces = new Map; // key: [row, col]; value: nearbyFaces
const check = (thres) => { // checks which black pixels are vertices for given threshold
  verticesSet.clear(); // same as vertices but in a set
  vertices = [];
  vertex_faces.clear(); 
  
  for (const pixel of blackPixels) {
    let nearbyFaces = new Set; //contains which faces surround the edge
    const r = pixel[0];
    const c = pixel[1];
    let queue = [[r, c, 0]];
    let checked = new Set([`${r}c${c}`]);
    let i = 0; 
    let d = 0; // dist from central pixel

    while (d < thres && nearbyFaces.size < 3) { // current size set at 11x11 square
      let row = queue[i][0];
      let col = queue[i][1];
      d = queue[i][2];
      i += 1;

      let neighbours = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
      for (const n of neighbours) {
        // coords of neighbour
        let nRow = n[0] + row;
        let nCol = n[1] + col;

        // check if pixel exists
        if (nRow < 0 || nRow > size[1]-1 || nCol < 0 || nCol > size[0]-1) {continue};
        
        // if exists, check if in queue/checked already
        if (checked.has(`${nRow}c${nCol}`)){continue};
        
        // check if pixel is part of face
        let ex = explored[nRow][nCol];
        if (ex[0] == "f" && !nearbyFaces.has(ex)) {
          nearbyFaces.add(Number(ex.substring(1)));
        };

        // add to queue
        checked.add(`${nRow}c${nCol}`);
        queue.push([nRow, nCol, d+1]);
      };
    };
    
    // pixel is a vertex pixel if more than 3 faces
    if (nearbyFaces.size > 2) {
      vertices.push(pixel);
      verticesSet.add(`${r}c${c}`);
      vertex_faces.set(`${r}c${c}`, nearbyFaces);
    };
  };
};

let v = new Map; // key: vertex number; value: array of pixel coords
const countVertices = (verticesSet) => {
  v.clear();
  graph.clear();
  let checked = new Set;
  let vertexNum = 1;
  for (const p of vertices) {
    if (checked.has(`${p[0]}c${p[1]}`)) {continue};
    let queue = [p];
    explored[p[0]][p[1]] = `v${vertexNum}`; // update pixel in the 2d array of the image
    let i = 0;
    v.set(vertexNum, [p]);

    while (i < queue.length) {
      let row = queue[i][0];
      let col = queue[i][1];
      i+=1;
      //console.log(queue);

      let neighbours = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
      for (const n of neighbours) {
        // coords of neighbour
        let nRow = n[0] + row;
        let nCol = n[1] + col;
        //console.log([nRow, nCol]);

        if (checked.has(`${nRow}c${nCol}`)) {continue}; // check if pixel was seen before

        if (verticesSet.has(`${nRow}c${nCol}`)) { // check if pixel exists in vertices
          queue.push([nRow, nCol]);
          v.get(vertexNum).push([nRow, nCol]);
          explored[nRow][nCol] = `v${vertexNum}`;
        };
        checked.add(`${nRow}c${nCol}`);
      };

    };
    
    let curr = v.get(vertexNum);
    if (curr.length < 5) {
      for (const r of curr) { // revert pixels back if vertex is too small
        explored[r[0]][r[1]] = true;
      };
      v.delete(vertexNum);
      continue;
    };
    graph.set(vertexNum, new Set);
    vertexNum += 1;
  };
  return v.size;
};


// shows the identified vertex pixels
const show = (images, vertices) => {
  const canvas = document.createElement("canvas");
  images.append(canvas);
  canvas.width = size[0];
  canvas.height = size[1];
  canvas.style.margin = "2px";
    
  const context = canvas.getContext("2d");
  const orig = document.getElementById("original");
  context.drawImage(orig, 0, 0);
    
  const frame = context.getImageData(0, 0, size[0], size[1]);
  const data = frame.data;
  
  for (let i = 0; i < vertices.length; i++) {
    const row = vertices[i][0];
    const col = vertices[i][1];
    const p = (size[0]*row + col) << 2;
    const red = [255, 0, 0, 255];
    red.forEach((c, j) => data[p + j] = c);
  };
  
  context.putImageData(frame, 0, 0);
};


const connect = (vertices, vertex_faces) => {
  // maybe update the explored array to contain which vertex does the pixel belong to
  //for each pixel in the vertices array, check which vertex it is in using explored
  // then access that vertex and add new face if any face is not in there
  for (const vertex_pixel of vertices) {
    
    let row = vertex_pixel[0];
    let col = vertex_pixel[1];
    if (explored[row][col] == true) {continue};

    //console.log([row, col]);
    let vertex_num = Number(explored[row][col].substring(1));
    
    let allFaces = graph.get(vertex_num);

    for (const face of vertex_faces.get(`${row}c${col}`)) {
      if (!allFaces.has(face)) {
        allFaces.add(face);
      };
    };
  };
};


const highlight = (str) => {
  const a = str[0] == "f" ? faces : v;
  const num = Number(str.slice(1));
  const curr = a.get(num);

  const canvas = document.createElement("canvas");
  images.append(canvas);
  canvas.width = size[0];
  canvas.height = size[1];
  canvas.style.margin = "2px";
    
  const context = canvas.getContext("2d");
  const orig = document.getElementById("original");
  context.drawImage(orig, 0, 0);
    
  const frame = context.getImageData(0, 0, size[0], size[1]);
  const data = frame.data;
  
  for (let i = 0; i < curr.length; i++) {
    const row = str[0] == "f" ? Number(curr[i].split("c")[0]) : curr[i][0];
    const col = str[0] == "f" ? Number(curr[i].split("c")[1]) : curr[i][1];
    
    const p = (size[0]*row + col) << 2;
    const red = [255, 0, 0, 255];
    red.forEach((c, j) => data[p + j] = c);
  };
  context.putImageData(frame, 0, 0);
};

let coords = [];
const shrink = () => {
  coords = [];
  for (let vert = 1; vert < (v.size+1); vert++) {
    let row = 0;
    let col = 0;
    for (const p of v.get(vert)) {
      row += p[0];
      col += p[1];
    };
    const len = v.get(vert).length;
    let centroid_row = Math.floor(row/len);
    let centroid_col = Math.floor(col/len);

    // if the centroid is not a vertex pixel, find the nearest vertex pixel that is within 2 px of it
    if (explored[centroid_row][centroid_col][0] != "v") {
      let neighbours = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1], 
            [-2, -2], [-2, -1], [-2, 0], [-2, 1], [-2, 2], [-1, -2], [-1, 2], [0, -2], [0, 2], [1, -2], [1, -2],
            [2, -2], [2, -1], [2, 0], [2, 1], [2, 2]];
      for (const n of neighbours) {
        // coords of neighbour
        let nRow = n[0] + centroid_row;
        let nCol = n[1] + centroid_col;
        if (explored[nRow][nCol][0] == "v") {
          centroid_row = nRow;
          centroid_col = nCol;  
        }
      };
    };

    coords.push([centroid_row, centroid_col]);

    
  };
};


let coord2 = [];
let others = new Map;
const shrink2 = () => { // TO DELETE IN FINAL VERSION
  coord2 = [];
  /*
  for (let vert = 1; vert < (v.size+1); vert++) {
    let pixel = [];
    let largest_dist = 0;
    others.set(vert, []);
    for (const p of v.get(vert)) {
      const r = p[0];
      const c = p[1];
      let queue = [[r, c, 0]];
      let checked = new Set([`${r}c${c}`]);
      let i = 0;
      let d = 0;
      let found = false;

      while (!found) {
        let row = queue[i][0];
        let col = queue[i][1];
        d = queue[i][2];
        i+=1;

        let neighbours = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        for (const n of neighbours) {
          // coords of neighbour
          let nRow = n[0] + row;
          let nCol = n[1] + col;
          // if exists, check if in queue/checked already
          if (checked.has(`${nRow}c${nCol}`)){continue};

          if (pic[nRow][nCol] == 255) {
            d+=1;
            found = true;
            break;
          };

          checked.add(`${nRow}c${nCol}`);
          queue.push([nRow, nCol, d+1]);
        };
      };
      if (d > largest_dist) {
        largest_dist = d;
        pixel = [r, c];
      };
      
      if (d == largest_dist) {
        others.get(vert).push([r, c]);
      };
    };
    coord2.push(pixel);
  };
  return(coord2);
  */

  
  for (let vert = 1; vert < (v.size+1); vert++) {
    let rows = [];
    let cols = [];
    for (const p of v.get(vert)) {
      rows.push(p[0]);
      cols.push(p[1]);
    };
    rows.toSorted((a, b) => a-b);
    cols.toSorted((a, b) => a-b);
    const middle = Math.floor(v.get(vert).length/2);
    coord2.push([rows[middle], cols[middle]]);
  };
  
};

let corners = [];

const reval = () => {
  let row_max = 0;
  let col_max = 0;
  let row_min = 500;
  let col_min = 500;
  for (let i = 1; i < v.size+1; i++) {
    for (const p of v.get(i)) {
      if (p[0] > row_max) {row_max = p[0];}
      if (p[0] < row_min) {row_min = p[0];}
      if (p[1] > col_max) {col_max = p[1];}
      if (p[1] < col_min) {col_min = p[1];}
    };
  };
  corners = [[row_min, col_min], [row_min, col_max], [row_max, col_min], [row_max, col_max]];
  /*
  for (let i = 1; i < v.size+1; i++) {
    const vertex = v.get(i);
    let rows = [vertex[0], vertex[0]];
    let cols = [vertex[0], vertex[0]];
    for (const p of vertex) {
      if (p[0] < rows[0][0]) {rows[0] = p;}
      if (p[0] > rows[1][0]) {rows[1] = p;}
      if (p[1] < cols[0][1]) {cols[0] = p;}
      if (p[1] > cols[1][1]) {cols[1] = p;}
    };
    v_rows.push(rows);
    v_cols.push(cols);
  };
  */
};
const evaluate = () => {
  
  
  let corners = [blackPixels[0]];

  let img_corners = [[0, size[0]-1], [size[1]-1, 0], [size[1]-1, size[0]-1]];
  for (const c of img_corners) {
    const cRow = c[0];
    const cCol = c[1];
    console.log([cRow, cCol]);
    
    if (pic[cRow][cCol][0] == 0) {
      corners.push(c);
      continue;
    };
    
    corners.push(find_vertex(cRow, cCol));
  };
  
  console.log(corners);
  //show_corners(img_corners);
  
  // for removing any previously identified corner vertices
  for (const i of corners) {
    let has_vertex = false;
    for (let j = 0; j < coords.length; j++) { // checks dist from corner pixel to vertex pixel
      const p = coords[j];
      const dist = Math.sqrt((p[0]-i[0])**2 + (p[1]-i[1])**2);
      if (dist < 20) { // if too close, remove the vertex pixel and replace with corner pixel
        has_vertex = true;
        coords[j] = i;
        break;
      };
    };
    if (!has_vertex) {
      coords.push(i);
      graph.set(graph.size+1, new Set);
    };
  };
};

const find_vertex = (r, c) => {
  let vertex = [];
  let queue = [[r, c]];
  let i = 0;
  let checked = new Set([`${r}c${c}`]);
  while (vertex.length == 0) {
    // get pixel from queue
    let row = queue[i][0];
    let col = queue[i][1];
    i += 1;

    let neighbours = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    for (const n of neighbours) {
      // coords of neighbour
      let nRow = n[0] + row;
      let nCol = n[1] + col;

      // check if pixel exists
      if (nRow < 0 || nRow > size[1]-1 || nCol < 0 || nCol > size[0]-1) {continue};
      
      // if exists, check if in queue/checked already
      if (checked.has(`${nRow}c${nCol}`)) {continue};


      if (pic[nRow][nCol] == 0) {
        vertex.push(nRow, nCol);
        break;
      };

      // add to queue
      checked.add(`${nRow}c${nCol}`);
      queue.push([nRow, nCol]);
    };
  };
  return(vertex);
};

const show_vertices = () => {
  const canvas = document.createElement("canvas");
  images.append(canvas);
  canvas.width = size[0];
  canvas.height = size[1];
  canvas.style.margin = "2px";
    
  const context = canvas.getContext("2d");
  const orig = document.getElementById("original");
  context.drawImage(orig, 0, 0);
    
  const frame = context.getImageData(0, 0, size[0], size[1]);
  const data = frame.data;
  
  for (let i = 0; i < coords.length; i++) {
    const row = coords[i][0];
    const col = coords[i][1];
    
    const p = (size[0]*row + col) << 2;
    const red = [255, 0, 0, 255];
    red.forEach((c, j) => data[p + j] = c);
  };

  
  for (let vert = 1; vert < (others.size+1); vert++) {
    for (const p of others.get(vert)) {
      const row = p[0];
      const col = p[1];
    
      const pix = (size[0]*row + col) << 2;
      const red = [255, 0, 0, 255];
      red.forEach((c, j) => data[pix + j] = c);
    };
  };

  
  context.putImageData(frame, 0, 0);
};

const show_corners = (corners) => {
  const canvas = document.createElement("canvas");
  images.append(canvas);
  canvas.width = size[0];
  canvas.height = size[1];
  canvas.style.margin = "2px";
    
  const context = canvas.getContext("2d");
  const orig = document.getElementById("original");
  context.drawImage(orig, 0, 0);
    
  const frame = context.getImageData(0, 0, size[0], size[1]);
  const data = frame.data;

  for (let i = 0; i < corners.length; i++) {
    const row = corners[i][0];
    const col = corners[i][1];
    
    const p = (size[0]*row + col) << 2;
    const red = [255, 0, 0, 255];
    red.forEach((c, j) => data[p + j] = c);
  };
    
  context.putImageData(frame, 0, 0);
};