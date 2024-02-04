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