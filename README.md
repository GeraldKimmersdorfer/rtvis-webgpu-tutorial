![Final result of this tutorial. Left: one marker for each tree. Right: heatmap of tree count](images/screenshot.png)

# Real Time Visualization WebGPU Tutorial

by Lucas Melo, Lukas Herzberger, Patrick Komon, Stefan Brandmair and Gerald Kimmersdorfer


- [Real Time Visualization WebGPU Tutorial](#real-time-visualization-webgpu-tutorial)
  - [Introduction](#introduction)
  - [Task 0 - Initialize WebGPU](#task-0---initialize-webgpu)
  - [Task 1 - Compute Shader Basics](#task-1---compute-shader-basics)
  - [Task 2 - Processing Real Data](#task-2---processing-real-data)
  - [Task 3 - Render an Image](#task-3---render-an-image)
  - [Task 4 - Render Trees as Markers](#task-4---render-trees-as-markers)
  - [Bonus Task - Compute and Render Heatmap](#task-5---compute-and-render-heatmap)

## Introduction

**Welcome to the Real Time Visualization WebGPU Tutorial!**

This is a 90 minute tutorial. It consists of 4 tasks and 1 bonus task. By the end of it, you will have built your own neat little app to visualize the trees of Vienna.

WebGPU-capable browsers:
- Windows: Firefox, Chrome, Edge
- Linux: Firefox Nightly or Chromium
  - Install from here: [https://github.com/scheib/chromium-latest-linux](https://github.com/scheib/chromium-latest-linux)
  - Enable the flags listed here: [https://github.com/gpuweb/gpuweb/wiki/Implementation-Status#chromium-chrome-edge-etc](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status#chromium-chrome-edge-etc)
- MacOS: Chrome or Safari (macOS Tahoe 26 or later)


### Resources

- [Tutorial slides](slides.pdf)
- [WebGPU Fundamentals](https://webgpufundamentals.org/)
- [WebGPU Shading Language (WGSL) Tutorial](https://webgpufundamentals.org/webgpu/lessons/webgpu-wgsl.html)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [WGSL Specification](https://www.w3.org/TR/WGSL/)

## Task 0 - Getting ready

To get started, you need [GIT](https://git-scm.com/), a code editor of your choice and an HTTP Server to proceed. We recommend using [VS Code](https://code.visualstudio.com/) with the [Live Preview](https://marketplace.visualstudio.com/items?itemName=ms-vscode.live-server) extension.

- Clone this repository (`git clone https://github.com/Welko/rtvis-webgpu-tutorial`)
- Serve `index.html` with a HTTP server.
- Open `src/tutorial.js` in your IDE. All your Javascript code will go there.

### 0.1 Initialize WebGPU

The first task is to evaluate whether WebGPU is actually supported and store a handle to the respective WebGPU module in `this.gpu`. Finish the function initializeWebGPU such that it assigns `navigator.gpu` to `this.gpu` and throws an error if WebGPU is not supported. It should report via the console if it is indeed supported.

<details>
<summary>Solution - Initialize WebGPU</summary>

```javascript
async initializeWebGPU() {
    if (!this.gpu) {
        this.gpu = navigator.gpu;
        if (!this.gpu) {
            const message = "WebGPU is not supported in your browser. Please use/update Chrome or Edge.";
            alert(message);
            throw new Error(message);
        }
        console.log("Hooray! WebGPU is supported in your browser!");
    }
}
```
</details>

---

Now open your browser console and look at the message.
- Chrome-based - `Ctrl + Shift + J`
- Firefox - `Ctrl + Shift + K`

![Result of task 0: WebGPU is supported!](images/task0.png)

## Task 1 - Compute Shader Basics

Duration: 10 minutes

Unlike WebGL, WebGPU **does not need a canvas**. It can be used only for its compute capabilites.

We start by creating a very simple shader that writes the index of each thread into a list of values. In this tutorial, that list will hold one value per district of Vienna.


### 1.1 Get the GPU device
Similar to Vulkan, WebGPU uses an `adapter` and a `device` to communicate with the GPU. This can be seen as a handle to the physical GPU in your workstation. In this subtask your goal is to fetch the (default) adapter and the (default) `device` and store it in the `this.device` variable. Add the implementation inside the `initializeWebGPU` function.

<details>
  <summary>Solution - Getting the GPU device</summary>

```javascript
async initializeWebGPU() {
    ...
    this.adapter = await this.gpu.requestAdapter();
    this.device = await this.adapter.requestDevice();
}
```
  </details>

### 1.2 Create the GPU Buffer

A GPU Buffer can be seen as the equivalent of an array of bytes that needs to be allocated. For this task we need an array of 23 unsigned integers (one per district in Vienna). It needs to have the `STORAGE` usage flag, because we will directly access it in the shader and the `COPY_SRC` as it will be copied to the CPU (via a different Buffer - more on that later). Use `this.device.createBuffer` to create the buffer and store it in the `this.gpuAggregatedValues` variable. Add the implementation to the `initializeBuffers` function.

<details>
  <summary>Solution - Creating a GPU Buffer</summary>

```javascript
async initializeBuffers() {
    this.gpuAggregatedValues = this.device.createBuffer({
      size: 23 * Uint32Array.BYTES_PER_ELEMENT, // 23 unsigned integers (one per district in Vienna)
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });
}
```

</details>

### 1.3 Writing the GPU shader

For the sake of this tutorial a shader can be seen as a small script which runs on the GPU which is executed in parallel.
Open the compute shader [`src/shaders/aggregate.wgsl`](src/shaders/aggregate.wgsl). 

> [!NOTE]
> 
> The programming language of WebGPU shaders is `wgsl`. If you are using Visual Studio Code, we recommend you install the extension [wgsl-analyzer](https://marketplace.visualstudio.com/items?itemName=wgsl-analyzer.wgsl-analyzer).

The first thing we'll add here is the **buffer binding** for the buffer we just created. We will bind it in group 0, binding 0 location.

<details>
  <summary>Solution - Add Buffer Binding</summary>

```wgsl
// At binding 0, we have a read-write storage buffer
@group(0) @binding(0) var<storage, read_write> aggregatedValues: array<u32>; // Array of 32-bit unsigned integers
```

</details>

---

Then we add our **compute entry point**. For this we have to define the workgroup size. In WebGPU, a **workgroup** is a fixed-size group of threads that are executed in parallel. We will use a workgroup size of 64 threads as this gives usually a good balance between performance and memory usage.

<details>
  <summary>Solution - Compute Entry Point</summary>

```wgsl
@compute
@workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
    // Our shader code goes here
}
```
</details>

---

Because we only have 23 districts, but we run at least 64 threads, we need to guard against out-of-bounds access to the buffer. To prevent undefined access to our data, we add an **out-of-bounds guard** at the beginning of the `main` function.


<details>
  <summary>Solution - Out of Bounds Guard</summary>

```wgsl
@compute
@workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
    // globalId.x is our thread ID
    if globalId.x >= arrayLength(&aggregatedValues) {
        // Current thread is out of bounds. Do nothing.
        return;
    }
}
```
</details>

---

Finally, we can write our extremly complex shader logic ;). We simply set the value of the buffer at the current thread ID to the current thread ID.

<details>
  <summary>Solution - Shader Logic</summary>

```wgsl
@compute
@workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
    ...
    aggregatedValues[globalId.x] = globalId.x;
}
```
</details>

### 1.4 Initializing the GPU pipeline

Please make sure that you have saved the shader file and switch back to [`tutorial.js`](src/tutorial.js).

A GPU pipeline for a Compute Shader is straight-forward as it basically only contains the information about the entry point and the shader code. For this subtask you have to use `this.device.createComputePipeline` and `this.device.createShaderModule` to create the pipeline we'll later execute. Implement `initializePipelines()` to create the pipeline and store it in `this.aggregatePipeline`.

> [!IMPORTANT]
> 
> The shader code is automatically loaded by `src/shaders.js` and made available as `SHADERS.aggregate`.

<details>
<summary>Solution - Initialize Pipeline</summary>

```javascript
async initializePipelines() {
    this.aggregatePipeline = this.device.createComputePipeline({
        // Use simplistic auto-generation
        // Bigger applications will manually generate a layout, and share it across multiple shaders
        layout: "auto", 
        compute: {
            module: this.device.createShaderModule({
                code: SHADERS.aggregate,
                label: "aggregate"
            }),
        }
    });
}
```
</details>

### 1.5 Creating the GPU Bind Group

Next, we must define the connection between our GPU buffer and a binding in the pipeline. If you used `layout: "auto"`, the bindings are defined automatically for us. The **pipeline** bindings must match the **shader** bindings.

We create this connection via a **bind group** (a group of bindings). Use `this.device.createBindGroup` to create the bind group and store it in `this.aggregateBindGroup`. Remember that we used `@group(0) @binding(0)` for our buffer in the shader code.

<details>
<summary>Solution - Create Bind Group</summary>

```javascript
async initializeBindGroups() {
    this.aggregateBindGroup = this.device.createBindGroup({
        layout: this.aggregatePipeline.getBindGroupLayout(0), // group(0)
        entries: [
            {
                binding: 0, // Matches our shader!
                resource: {
                    buffer: this.gpuAggregatedValues // Our district values!
                }
            }
        ]
    });
}
```
</details>

### 1.6 Lets compute
There is one last thing left before executing our pipeline. The pipeline with its bind group is executed through a GPU **command**. Commands in WebGPU are encoded in batch, so that they can all be sent to the GPU at once. That is done via a **command encoder**.

In this Subtask you have to use `this.device.createCommandEncoder` to create the command encoder. Use the `CommandEncoder.beginComputePass` function to creat a compute pass and  make sure to set the pipeline and the bind group we just created. Dispatch one workgroup. (This will start 64 threads, as defined in the shader)

Since this will be done each rendering step your implementation should be inside the `render` function.

<details>
<summary>Solution - Create Command Encoder and Compute Pass</summary>

```javascript
async render() {
    const commandEncoder = this.device.createCommandEncoder();
    {
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.aggregatePipeline);
        computePass.setBindGroup(0, this.aggregateBindGroup);
        computePass.dispatchWorkgroups(1); // Only one workgroup! (64 threads, as defined in the shader)
        computePass.end();
    }
}
```
</details>

---

Finally use `CommandEncoder.finish` to create the command buffer.

With our command buffer created, we can finally submit it to the GPU, and our shader code will be executed! Use `this.device.queue.submit` to submit the command buffer to the GPU.

<details>
<summary>Solution - Create Command Encoder and Compute Pass</summary>

```javascript
async render() {
    ...
    const commandBuffer = commandEncoder.finish();
    this.device.queue.submit([commandBuffer]);
}
```
</details>

### 1.7 Reading the data back to the CPU

The last step for this task is now to read the data back to the CPU, where we can print it to the console.

However, we cannot read directly from our buffer. Our buffer was created with `usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC`. To read from it, it must contain the usage flag `GPUBufferUsage.MAP_READ`. However, this usage flag cannot be used in combination with any other usage flags except for `GPUBufferUsage.COPY_DST`.

The solution: We must create a separate buffer to copy our data into.

In this part, we skip the details and encourage you to understand it in more detail on your own at another time. Feel free to directly use the provided solution or read more about it [here](https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer#examples).

<details>
<summary>Solution - CPU Buffer Readback</summary>

```javascript
async readBuffer(gpuBuffer, outputArray) {
    // This buffer can be read on the CPU because of MAP_READ
    const readBuffer = this.device.createBuffer({
        size: outputArray.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });

    // Copy from 'gpuBuffer' to 'readBuffer'
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(gpuBuffer, 0, readBuffer, 0, outputArray.byteLength);
    this.device.queue.submit([commandEncoder.finish()]);

    // Map the GPU data to the CPU
    await readBuffer.mapAsync(GPUMapMode.READ);

    // Read the data
    const ArrayType = /** @type {new (buffer: ArrayBufferLike) => T} */ (outputArray.constructor);
    const resultData = new ArrayType(readBuffer.getMappedRange());

    // Copy the data to the output array
    outputArray.set(resultData);

    // The read buffer is no longer needed
    readBuffer.destroy();

    return outputArray;
}
```
</details>

### 1.8 Finally: Lets verify 🎉

The last thing left to do is print our data on the console! Please add the `console.log`-line to the end of the `render` function.

> [!IMPORTANT]
> Be aware that GPU readback is slow and therefore usually implemented as async operation. CPU <-> GPU synchronization should always be kept to a minimum. In this task we simply use `await` to wait for the readback to finish. In performance-critical situations, you may use a ring buffer to avoid blocking the GPU/CPU.

<details>
<summary>Solution - CPU Buffer Readback</summary>

```javascript
async render() {
    ...
    console.log(await this.readBuffer(this.gpuAggregatedValues, new Uint32Array(23)));
}
```
</details>

---

You should now see the following output in your console:


**Congratulations! We're done!** In the next task, we will actually work with real-life data and replace our useless logic with something meaningful. :D

## Task 2 - Processing Real Data

Duration: 15 minutes

We start by loading some real data. The data we use here is from the [
Baumkataster bzw. Bäume Standorte Wien](https://www.data.gv.at/katalog/dataset/c91a4635-8b7d-43fe-9b27-d95dec8392a7), a dataset of trees in Vienna.

The data can be conveniently loaded with the provided `LOADER`.
We use this to load information per tree in a single list, in the format 

```javascript
[
    treeHeightCategory0, crownDiameterCategory0, districtNumber0, circumferenceAt1mInCm0,
    treeHeightCategory1, crownDiameterCategory1, districtNumber1, circumferenceAt1mInCm1,
    ...
]
```

and write it to a GPU buffer. We may completely replace the old data and buffers with the new ones.

```javascript
async initializeBuffers() {
    this.trees = await LOADER.loadTrees(); // Load 100 trees

    // TreeInfo
    this.gpuTreeInfo = this.device.createBuffer({
        size: this.trees.getInfoBuffer().byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(this.gpuTreeInfo, 0, this.trees.getInfoBuffer());
}
```

Now we have replaced our `data` array with `trees.getInfoBuffer()` and renamed our `buffer` to `gpuTreeInfo`. This change also needs to be reflected in our `initializeBindGroups`and `render` functions:

```javascript
async initializeBindGroups() {
    ...
                    buffer: this.gpuTreeInfo // Our new tree data!
    ...
}
...
async render() {
    ...
    console.log(await this.readBuffer(this.gpuTreeInfo, new Uint32Array(this.trees.getInfoBuffer().length)));
}
```

If we now refresh the page, you'll notice that the first 64 values of our buffer are at least 100, as expected.

However, now we do something more interesting than that. We can now use this data to count the number of trees for each district in Vienna. For a large number of trees, it is much faster to do this on the GPU in parallel rather than on the CPU. For that, we write a new shader.

Open `src/shaders/aggregate.wgsl`. 

Note that some things are already set up for you. Most importantly, our buffer bindings:

```wgsl
struct AggregatedValues {
    // Array of 23 atomic unsigned integers (one for each district in Vienna)
    districtNumberOccurrences: array<atomic<u32>, 23>,
}

// Our storage buffer at binding 0 now is of type TreeInfo (see the TreeInfo struct)
@group(0) @binding(0) var<storage, read> treeInfo: array<TreeInfo>;

// A second storage buffer is added, where our (atomic) counts are stored
// We need to create a new buffer for this!
@group(0) @binding(1) var<storage, read_write> aggregatedValues: AggregatedValues;
```

The only thing left to add is accessing the tree info for each tree and incrementing the count of its district.

```wgsl
let treeInfo: TreeInfo = treeInfo[globalId.x];

// Increment one to district number
let districtNumber = treeInfo.districtNumber;
atomicAdd(&aggregatedValues.districtNumberOccurrences[districtNumber - 1], 1);
```

Back to Javascript, creating the buffer that we will use for the aggregated values is simple, since we don't need to initialize its data (it is initialized with zeros).

```javascript
async initializeBuffers() {
    ...
    this.gpuAggregatedValues = this.device.createBuffer({
        size: 23 * Uint32Array.BYTES_PER_ELEMENT, // 23 unsigned integers (one per district in Vienna)
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });
}
```

With a new **shader** and a new **buffer**, we must also create a new **pipeline** and a new **bind group**.

```javascript
async initializePipelines() {
    this.aggregatePipeline = this.device.createComputePipeline({
        layout: "auto",
        compute: {
            module: this.device.createShaderModule({ 
                code: SHADERS.aggregate,
                label: "aggregate" 
            }),
        }
    });
}

async initializeBindGroups() {
    this.aggregateBindGroup = this.device.createBindGroup({
        layout: this.aggregatePipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: this.gpuTreeInfo } },
            // Now we have a second buffer on binding 1!
            { binding: 1,  resource: { buffer: this.gpuAggregatedValues } }
        ]
    });
}
```

Almost done. Now we adjust the number of workgroups we're dispatching. Instead of just one, we calculate it based on how many trees we have.

Don't forget to also rename the pipeline and bind group we're using.

```javascript
async render() {
    ...
        const numTreeWorkgroups = Math.ceil(this.trees.getNumTrees() / 64); // 64 from shader
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.aggregatePipeline);
        computePass.setBindGroup(0, this.aggregateBindGroup);
        computePass.dispatchWorkgroups(numTreeWorkgroups);
        computePass.end();
    ...
}
```

Finally, we can now print the contents of the aggregates buffer.

```javascript
async render() {
    ...
    console.log(await this.readBuffer(this.gpuAggregatedValues, new Uint32Array(23)));
}
```

You should now see displayed on the console the number of trees counted per district (note that we start at index 0). In the image below, district 9 has 30 trees, district 10 has 0, district 11 has 7, etc.

![Result of the aggregation performed in task 2](images/task2.png)

## Task 3 - Render an Image

Duration: 10 minutes

<img src="data/vienna-satellite.png" alt="A map of Vienna, the result of task 3" height="500">

Finally we will render something on the screen. In this case, it will be just a simple texture.

The first step is to load our map data, which includes four images of Vienna: satellite, streets, outdoors, and height

```javascript
async initializeTextures() {
    this.map = await LOADER.loadMap(); // Load map images and geographical data
}
```

The images contained in map are ready to be used with WebGPU. So we can jump straight into creating our texture.

```javascript
async initializeTextures() {
    ...
    const image = this.map.images.outdoors; // Try 'satellite' or 'streets' as well
    this.gpuMapTexture = this.device.createTexture({
      size: [image.width, image.height],
      format: "rgba8unorm",
      // TEXTURE_BINDING is needed to bind the texture to the pipeline
      // We also need to copy the image to the texture, so we need COPY_DST and RENDER_ATTACHMENT as well
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING  | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture(
          {source: image, flipY: true}, // Source
          {texture: this.gpuMapTexture}, // Destination
          [image.width, image.height] // Size
    );
}
```

To finalize the initialization of our texture, we also create a sampler. It is through the sampler that we access the texture in the shaders.

```javascript
async initializeTextures() {
    ...
    this.sampler = this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear'
    });
}
```

Finally, we need to set the render size of the canvas to our image dimensions. This avoids sampling artifacts on the map and lets the browser do the work of downsampling our render output to the actual canvas (css) size.
```javascript
async initializeTextures() {
    ...
    // Set canvas render size to image dimension
    this.canvas.width = image.width;
    this.canvas.height = image.height;
}
```

With the texture data set up on the GPU, we begin the process of showing it on the screen. For this tutorial, we will write one vertex shader and one fragment shader, and we will render a quad (two triangles forming a rectangle).

For loading large 3D models, it can be beneficial to create a **vertex buffer**, which is used to feed data into our vertex shader.

Since we only render one quad (6 triangles with `triangle-list`), we hard-code the vertex and UV positions in the shader.

Open `src/shaders/image.wgsl`.

This time, you will find only the definitions of our vertices and UVs.

We begin by adding our bindings.

```wgsl
@group(0) @binding(0) var texture: texture_2d<f32>;
@group(0) @binding(1) var linearSampler: sampler;
```

Next, we define the vertex shader. Other graphics APIs provide global variables to manage access to the inputs and outputs of shaders (e.g., OpenGL with `gl_VertexID` or `gl_FragColor`). In WebGPU, the inputs and outputs are explicitly defined and are available as arguments in our entry point function.

```wgsl
struct VertexInput {
    @builtin(vertex_index) vertexIndex: u32, // Analogous to gl_VertexID in OpenGL
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
}

@vertex
fn vertex(input: VertexInput) -> VertexOutput {
    return VertexOutput(
        // Index our vertex/UV data using the current vertex's index
        // %6 just for safety in case the draw call has more than 6 vertices
        vec4f(VERTICES[input.vertexIndex % 6], 0, 1),
        UVS[input.vertexIndex % 6],
    );
}
```

In the fragment shader, we then use our sampler to sample the texture.

```wgsl
// The fragment input comes from the vertex shader's output (VertexOutput)

struct FragmentOutput {
    @location(0) color: vec4f,
}

@fragment
fn fragment(input: VertexOutput) -> FragmentOutput {
    let color = textureSample(texture, linearSampler, input.uv);
    return FragmentOutput(color);
}
```

Like previously, we must still create a **pipeline** and **bind group**.

First, for the pipeline:

```javascript
async initializePipelines() {
    const imageShaderModule = this.device.createShaderModule({ 
        code: SHADERS.image,
        label: "image"
    });
    this.imageRenderPipeline = this.device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: imageShaderModule,
            // buffers: We don't need any vertex buffer :)
        },
        fragment: {
            module: imageShaderModule,
            targets: [
                {
                    // Only one render target, where our color will be drawn
                    format: this.gpu.getPreferredCanvasFormat()
                }
            ]
        },
    });
}
```

Then for the bind group:

```javascript
async initializeBindGroups() {
    this.imageBindGroup = this.device.createBindGroup({
        layout: this.imageRenderPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: this.gpuMapTexture.createView() },
            { binding: 1, resource: this.sampler },
        ]
    });
}
```

There is one last step before rendering: setting up the HTML canvas. That is done analogously to WebGL (where we use `canvas.getContext("webgl)`), followed by a configuration of the context:

```javascript
async initializeWebGPU() {
    ...
    this.context = this.canvas.getContext("webgpu");
    this.context.configure({
        device: this.device,
        format: this.gpu.getPreferredCanvasFormat()
    });
}
```

And finally, we can encode our commands into a buffer and submit it to the GPU!
The **color attachment** of the render pass describes how the output behaves.

```javascript
async render() {
    const commandEncoder = this.device.createCommandEncoder();
    {
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                loadOp: "clear",
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                storeOp: "store"
            }]
        });
        renderPass.setPipeline(this.imageRenderPipeline);
        renderPass.setBindGroup(0, this.imageBindGroup);
        renderPass.draw(6); // 6 vertices - one quad
        renderPass.end();
    }
    const commandBuffer = commandEncoder.finish();
    this.device.queue.submit([commandBuffer]);
}
```

And, finally, you should see a map of Vienna on your screen.

<img src="data/vienna-outdoors.png" alt="A map of Vienna, the result of task 3" height="500">

## Task 4 - Render Trees as Markers

Duration: 20 minutes

<img src="images/task4.png" alt="A map of Vienna with one semi-transparent square marker per tree, the result of task 4" height="500">

Finally, in this task, we will get to render our tree data. 

Previously, we had loaded the tree information. Now, in addition to that, we also load the coordinates of the trees.

```javascript
async initializeBuffers() {
    ...
    // TreeCoordinates
    this.gpuTreeCoordinates = this.device.createBuffer({
        size: this.trees.getCoordinatesLatLonBuffer().byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.gpuTreeCoordinates, 0, this.trees.getCoordinatesLatLonBuffer());
}
```

With this data now available, we move on to this task's shaders.

Open `src/shaders/markers.wgsl`.

Our vertices and UVs are there again, together with the function `latLonToXY`, that converts latitude and longitude coordinates into XY coordinates in the range [0,1].

As you may have noticed, the function `latLonToXY` uses an object `u` that is not defined anywhere. This is our uniforms. Uniforms are not passed individually to a shader, but through an **uniform buffer**. We will define it now, together with our two other buffers.

```wgsl
struct TreeCoordinates {
    lat: f32,
    lon: f32,
}

struct TreeInfo {
    treeHeightCategory: u32,
    crownDiameterCategory: u32,
    districtNumber: u32,
    circumferenceAt1mInCm: u32,
}

struct Uniforms {
    mapWidth: f32,
    mapHeight: f32,
    mapLatitudeMin: f32,
    mapLatitudeMax: f32,
    mapLongitudeMin: f32,
    mapLongitudeMax: f32,
    markerSize: f32,
    unused: f32, // Padding
    markerColor: vec4f,
}

@group(0) @binding(0) var<storage, read> treeCoordinates: array<TreeCoordinates>;
@group(0) @binding(1) var<storage, read> treeInfo: array<TreeInfo>;
@group(0) @binding(2) var<uniform> u: Uniforms;
```

Our vertex shader will read from these buffers and use their information to decide where to place vertices and which color to use. Once again, we will not use vertex buffers here.

WebGPU, like other APIs, has **instanced rendering**. That allows us to draw one geometry several times with increased performance due to the reduced number of draw calls.

We will **NOT** use instanced rendering here. Instead, we go even more hardcore and derive the index of our (fake) instance based on its **vertex index**. Additionally to UV coordinates, we also pass a color to the fragment shader.

```wgsl
struct VertexInput {
    @builtin(vertex_index) vertexIndex: u32,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) color: vec4f,
}

@vertex
fn vertex(input: VertexInput) -> VertexOutput {
    // I'm so cool
    let treeIndex = input.vertexIndex / 6;

    // Get 2D position of tree
    let latLon = treeCoordinates[treeIndex];
    let xy = latLonToXY(latLon.lat, latLon.lon) * 2 - 1;

    // Calculate marker position and size
    let vertex = VERTICES[input.vertexIndex % 6] * u.markerSize + xy;

    // Get tree info
    let treeInfo = treeInfo[treeIndex];

    // Color based on tree district
    // THIS IS BAD VISUALIZATION
    // Ideally, the district number would be mapped into a qualitative color scheme
    // See colorbrewer2.org for some good ones
    let color23 = u.markerColor; // Color for Liesing
    let color1 = vec4f(0, 0, 0, color23.a); // Color for Innere Stadt
    let blendingFactor = f32(treeInfo.districtNumber - 1) / 22;
    let color = mix(color1, color23, blendingFactor);

    return VertexOutput(
        vec4f(vertex, 0, 1),
        UVS[input.vertexIndex % 6],
        color,
    );
}
```

And very little work is left for our fragment shader to do.

```wgsl
struct FragmentOutput {
    @location(0) color: vec4f,
}

@fragment
fn fragment(input: VertexOutput) -> FragmentOutput {
    return FragmentOutput(
        input.color,
    );
}
```

And now, back to Javascript, we create the uniforms buffer.

```javascript
async initializeBuffers() {
    ...
    // Uniforms
    this.uniforms = {
        markerSize: 0.01,
        markerColor: [255, 0, 0], // The screenshots use [117, 107, 177]
        markerAlpha: 0.01,
    };
    this.gpuUniforms = this.device.createBuffer({
        size: 1024, // Allocate 1024 bytes. Enough space for 256 floats/ints/uints (each is 4 bytes). That should be enough
        // UNIFORM (of course) and COPT_DST so that we can later write to it
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // Write to the uniforms buffer in render()
}
```

Note that we do not write into the uniforms buffer immediately. That is because its data may change very often. Because of that, we will write to it every frame.

```javascript
async render() {
    // Copy the uniforms to the GPU buffer
    // Warning: the layout must match the layout of the uniform buffer in the shader
    this.device.queue.writeBuffer(this.gpuUniforms, 0, new Float32Array([
        this.map.width,
        this.map.height,
        this.map.latitude.min,
        this.map.latitude.max,
        this.map.longitude.min,
        this.map.longitude.max,
        this.uniforms.markerSize,
        0, // Unused
        this.uniforms.markerColor[0] / 255,
        this.uniforms.markerColor[1] / 255,
        this.uniforms.markerColor[2] / 255,
        this.uniforms.markerAlpha,
    ]));
    ...
}
```

Now that we have all the buffers set up, we can proceed to creating our **pipeline** and **bind group** for the new shaders.

```javascript
async initializePipelines() {
    ...
    const markersShaderModule = this.device.createShaderModule({ 
        code: SHADERS.markers,
        label: "markers"
    });
    this.markersRenderPipeline = this.device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: markersShaderModule,
            // buffers: We don't need any vertex buffer :)
        },
        fragment: {
            module: markersShaderModule,
            targets: [{
                format: this.gpu.getPreferredCanvasFormat()
            }]
        }
    });
}

async initializeBindGroups() {
    ...
    this.markersBindGroup = this.device.createBindGroup({
        layout: this.markersRenderPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: this.gpuTreeCoordinates } },
            { binding: 1, resource: { buffer: this.gpuTreeInfo } },
            { binding: 2, resource: { buffer: this.gpuUniforms } },
        ]
    });
}
```

And now finally we can render the markers! We can render them immediately after the map, in the same render pass.

```javascript
async render() {
    ...
    const commandEncoder = this.device.createCommandEncoder();
    {
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                loadOp: "clear",
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                storeOp: "store"
            }]
        });

        // Render map
        renderPass.setPipeline(this.imageRenderPipeline);
        renderPass.setBindGroup(0, this.imageBindGroup);
        renderPass.draw(6); // One quad

        // Render markers
        renderPass.setPipeline(this.markersRenderPipeline);
        renderPass.setBindGroup(0, this.markersBindGroup);
        renderPass.draw(6 * this.trees.getNumTrees()); // As many quads as we have trees

        renderPass.end();
    }
    const commandBuffer = commandEncoder.finish();
    this.device.queue.submit([commandBuffer]);
}
```

And, with that, you should be able to finally see the tree markers on the screen!

To load more trees, go back to where you load the date (`initializeBuffers()`) and pass a `true` to `loadTrees()`, like so:

```javascript
this.trees = await LOADER.loadTrees(true); // Load 219,378 trees
```

**BONUS 1/3!** Activate blending (i.e., transparency)

```javascript
async initializePipelines() {
    ...
    this.markersRenderPipeline = this.device.createRenderPipeline({
        ...
        fragment: {
            module: markersShaderModule,
            targets: [{
                format: this.gpu.getPreferredCanvasFormat(),
                blend: { // This activates blending!
                    color: {
                        operation: "add",
                        srcFactor: "src-alpha",
                        dstFactor: "one-minus-src-alpha",
                    },
                    alpha: {
                        operation: "add",
                        srcFactor: "src-alpha",
                        dstFactor: "one-minus-src-alpha",
                    }
                }
            }]
        }
    });
}
```

**BONUS 2/3!** Add UI controls

```javascript
async initializeGUI() {
    const onChange = () => this.render();
    [
        this.gui.add(this.uniforms, "markerSize", 0.001, 0.1, 0.001),
        this.gui.addColor(this.uniforms, "markerColor"),
        this.gui.add(this.uniforms, "markerAlpha", 0.01, 1, 0.01),
    ]
    .forEach((controller) => controller.onChange(onChange));
}
```

**BONUS 3/3!** Another (still bad) color scheme

```wgsl
fn toMarkerColor(districtIndex: u32) -> vec3<f32> {
    // THIS IS STILL BAD VISUALIZATION
    // Ideally, the district number would be mapped into a qualitative color scheme
    // See colorbrewer2.org for some good ones

    // This number changes the color scheme
    let magicNumber = 555555u;
    return unpack4x8unorm(((districtIndex % 127) + 1) * magicNumber).rgb;
}

@vertex
fn vertex(input: VertexInput) -> VertexOutput {
    ...
    // Color based on tree district
    let color = vec4f(toMarkerColor(treeInfo.districtNumber - 1), u.markerColor.a);
    ....
}
```

And so we're done! Your map should have markers, just like the one in the screenshot below.

<img src="images/task4.png" alt="A map of Vienna with one semi-transparent square marker per tree, the result of task 4" height="500">

## Bonus Task - Compute and Render Heatmap

Duration: 30 minutes

<img src="images/task5.png" alt="A map of Vienna an overlaid heatmap of tree frequency, the result of task 5" height="500">

For the final task, we will combine compute and render passes to produce a heatmap that we display over the map of Vienna.

This will require the compute shader to go through each tree, find out in which cell of our heatmap grid it is contained, and then increment the cell's count by one. When rendering the grid cells, this value must then be mapped to a color. To do that, we must also find out what is the largest value stored among all grid cells.

Open `src/shaders/heatmapCompute.wgsl`.

You will find the definitions of two functions. We already know `latLonToXY`. The other function, `xyToCellIndex`, converts the XY coordinate of a tree into the index of a cell in our grid.

We start, as per usual, by defining our buffers. We introduce one buffer that stores all the cells in the grid (`array<Cell>`), and one buffer that stores the aggregate values across the grid (`Grid`). We also add two new values to our uniforms: the width and height of the grid.

```wgsl
struct TreeCoordinates {
    lat: f32,
    lon: f32,
}

struct TreeInfo {
    treeHeightCategory: u32,
    crownDiameterCategory: u32,
    districtNumber: u32,
    circumferenceAt1mInCm: u32,
}

struct Cell {
    // Each cell will hold its tree count
    treeCount: atomic<u32>
}

struct Grid {
    // Largest number of trees stores in a single cell of the grid
    maxTreeCount: atomic<u32>,
}

struct Uniforms {
    mapWidth: f32,
    mapHeight: f32,
    mapLatitudeMin: f32,
    mapLatitudeMax: f32,
    mapLongitudeMin: f32,
    mapLongitudeMax: f32,
    markerSize: f32,
    unused: f32, // Padding
    markerColor: vec4f,
    gridWidth: f32, // Number of cells on the grid's width
    gridHeight: f32, // Number of cells on the grid's height
}

@group(0) @binding(0) var<storage, read> treeCoordinates: array<TreeCoordinates>;
@group(0) @binding(1) var<storage, read> treeInfo: array<TreeInfo>;
@group(0) @binding(2) var<storage, read_write> cells: array<Cell>;
@group(0) @binding(3) var<storage, read_write> grid: Grid;
@group(0) @binding(4) var<uniform> u: Uniforms;
```

In this shader, we will introduce **three entry points**. One (called `count`) will be responsible to go through each tree and accumulate values on the grid cells (such as tree count). The second one (called `max`) will be responsible for going through each grid cell and finding the largest tree count. The third one (called `clear`) will reset the grid values and prepare it for the next pass (set all counts and the max value to zero).

First, we add the `count` entry point, which is very similar to the `add` shader we wrote in Task 1.

```wgsl
@compute @workgroup_size(64)
fn count(@builtin(global_invocation_id) globalId: vec3u) {
    if globalId.x >= arrayLength(&treeInfo) {
        return;
    }

    // Get tree index
    let treeIndex = globalId.x;

    // Get 2D position of tree
    let latLon = treeCoordinates[treeIndex];
    let xy = latLonToXY(latLon.lat, latLon.lon);

    // Get cell index
    let cellIndex = xyToCellIndex(xy);

    // Increment one to tree count and height category count
    atomicAdd(&cells[cellIndex].treeCount, 1);
}
```

Then, we add the `max` entry point.

```wgsl
@compute @workgroup_size(64)
fn max(@builtin(global_invocation_id) globalId: vec3u) {
    if globalId.x >= arrayLength(&cells) {
        return;
    }

    let cellIndex = globalId.x;

    let treeCount = atomicLoad(&cells[cellIndex].treeCount);

    atomicMax(&grid.maxTreeCount, treeCount);
}
```

And, finally, the `clear` entry point.

```wgsl
@compute @workgroup_size(64)
fn clear(@builtin(global_invocation_id) globalId: vec3u) {
    if globalId.x >= arrayLength(&cells) {
        return;
    }

    // Clear max tree count
    if globalId.x == 0 {
        atomicStore(&grid.maxTreeCount, 0);
    }

    let cellIndex = globalId.x;

    // Clear tree count
    atomicStore(&cells[cellIndex].treeCount, 0);
}
```

Now having completed our compute shader, before we move on to the vertex and fragment shaders, we go back to Javascript and create the new buffers we introduced.

```javascript
async initializeBuffers() {
    ...
    // Cells
    this.GRID_MAX_WIDTH = 200;
    this.GRID_MAX_HEIGHT = 200;
    this.gpuGridCells = this.device.createBuffer({
        // Reserve enough space for the maximum number of cells
        size: this.GRID_MAX_WIDTH * this.GRID_MAX_HEIGHT * Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE,
    });
    
    // Grid 
    this.gpuGrid = this.device.createBuffer({
        // One 32-bit unsigned integer
        size: Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE,
    });
}
```

Because we now introduced two new uniforms, we also set them up.

```javascript
async initializeBuffers() {
    ...
    this.uniforms = {
        ...
        gridWidth: 50,
        gridHeight: 50,
    };
    ...
}

async render() {
    this.device.queue.writeBuffer(this.gpuUniforms, 0, new Float32Array([
        ...
        this.uniforms.gridWidth,
        this.uniforms.gridHeight,
    ]));
    ...
}
```

Now, for the creation of the **pipeline** and **bind group** of our shaders. Because we have three entry points in our shader, we will need **three pipelines** that use the same **bind group**. So far, we've been using the pipeline's `"auto"` layout, and its `getBindGroupLayout()` function. However, in order to share the **bind group** among **pipelines**, we now need to create this layout manually.

```javascript
async initializeLayouts() {
    this.heatmapComputeBindGroupLayout = this.device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
            { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        ]
    });

    this.heatmapComputePipelineLayout = this.device.createPipelineLayout({
        bindGroupLayouts: [
            this.heatmapComputeBindGroupLayout,
        ]
    });
}
```

With the layouts created, we can then create the **pipelines** and the **bind group** as per usual

```javascript
async initializePipelines() {
    ...
    // Heatmap compute shaders
    const heatmapShaderModule = this.device.createShaderModule({
        code: SHADERS.heatmapCompute,
        label: "heatmapCompute",
    });
    this.heatmapComputeClearPipeline = this.device.createComputePipeline({
        layout: this.heatmapComputePipelineLayout,
        compute: { module: heatmapShaderModule, entryPoint: "clear" },
    });
    this.heatmapComputeCountPipeline = this.device.createComputePipeline({
        layout: this.heatmapComputePipelineLayout,
        compute: { module: heatmapShaderModule, entryPoint: "count" },
    });
    this.heatmapComputeMaxPipeline = this.device.createComputePipeline({
        layout: this.heatmapComputePipelineLayout,
        compute: { module: heatmapShaderModule, entryPoint: "max" },
    });
}

async initializeBindGroups() {
    ...
    this.heatmapComputeBindGroup = this.device.createBindGroup({
        layout: this.heatmapComputeBindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: this.gpuTreeCoordinates} },
            { binding: 1, resource: { buffer: this.gpuTreeInfo } },
            { binding: 2, resource: { buffer: this.gpuGridCells } },
            { binding: 3, resource: { buffer: this.gpuGrid } },
            { binding: 4, resource: { buffer: this.gpuUniforms } },
        ]
    });
}
```

We now add our new pipelines to a compute pass before rendering. We won't be able to see any result yet, but this will allow us to verify if our pipelines are set up correctly and there are no errors.

```javascript
async render() {
    ...
    const commandEncoder = this.device.createCommandEncoder();
    {
        // Compute pass
        const computePass = commandEncoder.beginComputePass();
        
        // Calculate number of workgroups to dispatch
        const numWorkgroupsTrees = Math.ceil(this.trees.getNumTrees() / 64);
        const numWorkgroupCells = Math.ceil(this.uniforms.gridWidth * this.uniforms.gridHeight / 64);

        // Set one bindgroup for all three pipelines
        computePass.setBindGroup(0, this.heatmapComputeBindGroup);

        // Clear
        computePass.setPipeline(this.heatmapComputeClearPipeline);
        computePass.dispatchWorkgroups(numWorkgroupCells);

        // Count
        computePass.setPipeline(this.heatmapComputeCountPipeline);
        computePass.dispatchWorkgroups(numWorkgroupsTrees);

        // Max
        computePass.setPipeline(this.heatmapComputeMaxPipeline);
        computePass.dispatchWorkgroups(numWorkgroupCells);

        computePass.end();
    }
    {
        // Render Pass
        ... 
    }
    const commandBuffer = commandEncoder.finish();
    this.device.queue.submit([commandBuffer]);
}
```

Now that we're done with the computation of the heatmap, we move on to displaying it.

Open `src/shaders/heatmapRender.wgsl`;

You will find the familiar vertices and UVs we saw before. That is because we are using the exact same technique we used to render the tree markers, where each grid cell will be rendered as a quad.

First, we introduce the buffer bindings.

```wgsl
struct Cell {
    treeCount: u32,
}

struct Grid {
    maxTreeCount: u32,
}

struct Uniforms {
    mapWidth: f32,
    mapHeight: f32,
    mapLatitudeMin: f32,
    mapLatitudeMax: f32,
    mapLongitudeMin: f32,
    mapLongitudeMax: f32,
    markerSize: f32,
    unused: f32,
    markerColor: vec4f,
    gridWidth: f32,
    gridHeight: f32,
}

@group(0) @binding(0) var<storage, read> cells: array<Cell>;
@group(0) @binding(1) var<storage, read> grid: Grid;
@group(0) @binding(2) var<uniform> u: Uniforms;
```

We have already discussed and created all buffers introduced here.

Next, we add the vertex shader.

```wgsl
struct VertexInput {
    @builtin(vertex_index) vertexIndex: u32,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) color: vec4f,
}

@vertex
fn vertex(input: VertexInput) -> VertexOutput {
    let cellIndex = input.vertexIndex / 6;

    // Get center of cell
    let xy = vec2f(
        (0.5 + f32(cellIndex % u32(u.gridWidth))) / u.gridWidth,
        (0.5 + f32(cellIndex / u32(u.gridWidth))) / u.gridHeight,
    ) * 2 - 1;

    // Get size of cell
    let size = vec2f(1 / u.gridWidth, 1 / u.gridHeight);
    
    // Calculate cell position and size
    let vertex = VERTICES[input.vertexIndex % 6] * size + xy;
    
    // Dummy value for now
    let color = vec4f(1, 0, 0, f32(cellIndex) / u.gridWidth / u.gridHeight);

    return VertexOutput(
        vec4f(vertex, 0, 1),
        UVS[input.vertexIndex % 6],
        color,
    );
}
```

Note that we are assigning an arbitrary color to each grid cell. Later, we will calculate it based on its tree count. For now, for debug purposes, we keep it like this.

Once again, the fragment shader doesn't do much.

```wgsl
struct FragmentOutput {
    @location(0) color: vec4f,
}

@fragment
fn fragment(input: VertexOutput) -> FragmentOutput {
    return FragmentOutput(
        input.color,
    );
}
```

With the shader created, we go back to Javascript and introduce our new **pipeline** and **bind group**.

```javascript
async initializePipelines() {
    ...
    const heatmapRenderShaderModule = this.device.createShaderModule({ 
        code: SHADERS.heatmapRender,
        label: "heatmapRender"
    });
    this.heatmapRenderPipeline = this.device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: heatmapRenderShaderModule,
            // buffers: We don't need any vertex buffer :)
        },
        fragment: {
            module: heatmapRenderShaderModule,
            targets: [{
                format: this.gpu.getPreferredCanvasFormat(),
                blend: {
                    color: { operation: "add", srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
                    alpha: { operation: "add", srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" }
                }
            }]
        }
    });
}

async initializeBindGroups() {
    ...
    this.heatmapRenderBindGroup = this.device.createBindGroup({
        layout: this.heatmapRenderPipeline.getBindGroupLayout(0),
        entries: [
            // We need to hide these for now until we use them in the shader (optimized out)
            //{ binding: 0, resource: { buffer: this.gpuGridCells } },
            //{ binding: 1, resource: { buffer: this.gpuGrid } },
            { binding: 2, resource: { buffer: this.gpuUniforms } },
        ]
    });
}
```

Now we render the heatmap to see if we did everything right so far.

```javascript
    async render() {
        ...
        const commandEncoder = this.device.createCommandEncoder();
        {
            // Compute pass
            ...
        }
        {
            // Render Pass
            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: this.context.getCurrentTexture().createView(),
                    loadOp: "clear",
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    storeOp: "store"
                }]
            });

            // Render map
            renderPass.setPipeline(this.imageRenderPipeline);
            renderPass.setBindGroup(0, this.imageBindGroup);
            renderPass.draw(6); // One quad

            // Render markers (deactivated)
            //renderPass.setPipeline(this.markersRenderPipeline);
            //renderPass.setBindGroup(0, this.markersBindGroup);
            //renderPass.draw(6 * this.trees.getNumTrees()); // As many quads as we have trees

            // Render heatmap
            renderPass.setPipeline(this.heatmapRenderPipeline);
            renderPass.setBindGroup(0, this.heatmapRenderBindGroup);
            renderPass.draw(6 * this.uniforms.gridWidth * this.uniforms.gridHeight); // As many quads as we have grid cells

            renderPass.end();
        }
        const commandBuffer = commandEncoder.finish();
        this.device.queue.submit([commandBuffer]);
    }
```

You should now see a a red gradient over the map.

Uncomment our buffer bindings.

```javascript
async initializeBindGroups() {
    ...
    this.heatmapRenderBindGroup = this.device.createBindGroup({
        layout: this.heatmapRenderPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: this.gpuGridCells } },
            { binding: 1, resource: { buffer: this.gpuGrid } },
            { binding: 2, resource: { buffer: this.gpuUniforms } },
        ]
    });
}
```

Open `src/shaders/heatmapRender.wgsl`.

Remove the `// Dummy value for now` section and instead calculate a color value based on the tree count.

```wgsl
// Map color based on tree count
let maxCount = grid.maxTreeCount;
let count = cells[cellIndex].treeCount;
let color1 = vec4f(u.markerColor.rgb, 1);
let color0 = vec4f(color1.rgb, color1.a * 0.2);

// Linear blending
let blendingFactor = f32(count) / f32(maxCount);

// Logarithmic blending
//let blendingFactor = log2(f32(count) + 1) / log2(f32(maxCount) + 1);

var color = mix(color0, color1, blendingFactor);
if count == 0 {
    color.a = 0;
}
```

And finally, the heatmap is done!

**BONUS!** Add UI controls

```javascript
async initializeGUI() {
    const onChange = () => this.render();
    [
        this.gui.add(this.uniforms, "gridWidth", 1, this.GRID_MAX_WIDTH, 1),
        this.gui.add(this.uniforms, "gridHeight", 1, this.GRID_MAX_HEIGHT, 1),
    ]
    .forEach((controller) => controller.onChange(onChange));
}
```

<img src="images/task5.png" alt="A map of Vienna an overlaid heatmap of tree frequency, the result of task 5" height="500">

## Congrats!

That concludes the tutorial `:)`

