import { LOADER } from "../src/loader.js";
import { SHADERS } from "./shaders.js";
import { visualize_district_info } from "../lib/vienna-vis.js";

export class Tutorial {

    async start() {
        await this.initializeWebGPU();
        await this.initializeBuffers();
        await this.initializeTextures();
        await this.initializeLayouts();
        await this.initializePipelines();
        await this.initializeBindGroups();
        await this.initializeAttachments();
        await this.initializeGUI();
        await this.render();
    }

    /**
     * @param {import("../lib/lil-gui.esm.js").GUI} gui 
     * @param {HTMLCanvasElement} canvas 
     */
    constructor(gui, canvas) {
        this.gui = gui;
        this.canvas = canvas;
    }

    // From here on, it is up to you to implement the tutorial
    // ----------------------------------------------------------------------------------------------------

    async initializeWebGPU() {

    }

    async initializeBuffers() {

    }

    async initializeTextures() {
        
    }

    async initializeLayouts() {
        
    }

    async initializePipelines() {

    }

    async initializeBindGroups() {

    }

    async initializeAttachments() {
        
    }

    async initializeGUI() {

    }

    /**
     * @template {Float32Array | Uint32Array | Int32Array} T
     * @param {GPUBuffer} gpuBuffer
     * @param {T} outputArray
     * @returns {Promise<T>}
     */
    async readBuffer(gpuBuffer, outputArray) {
        return null;
    }

    async render() {

    }

}