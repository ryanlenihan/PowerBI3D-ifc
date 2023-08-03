/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;

import { VisualFormattingSettingsModel } from "./settings";



/** webgl_loader_ifc */
//https://threejs.org/examples/webgl_loader_ifc.html

//import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
//import { IFCLoader } from "three/examples/jsm/loaders/IFCLoader.js";
//import {init} from  "./web-ifc-viewer_main.js";
//import 'es-module-shims/dist/es-module-shims.js'

import * as THREE from 'three';//'./web-ifc-lib/three.module.js';


import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

import { IFCLoader } from 'web-ifc-three/IFCLoader.js';
import { IFCSPACE,IFCOPENINGELEMENT}  from 'web-ifc/web-ifc-api.js';
//import { IFCModel } from "three/examples/jsm/loaders/IFCLoader.js";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";

/** */


export class Visual implements IVisual {

    private target: HTMLElement;
    private updateCount: number;
    private textNode: Text;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;

    private imgElement: HTMLImageElement;
    private fileupload: HTMLInputElement;
    private debugElememnt: HTMLElement;
    public newfileuploaded: boolean = true;
    private canvasElement: HTMLCanvasElement;

    public host: IVisualHost;
    public options: VisualUpdateOptions; // so we cann call update from the constructor when the model is loaded
    private selectionManager: ISelectionManager;
    public static Instance: Visual;
    public static Instances: Visual[] = [];

    private ifcLoader: IFCLoader; 
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;//THREE.Camera; 
    public renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;


    constructor(options: VisualConstructorOptions) {
        
        //console.log('Visual constructor', options);
        this.formattingSettingsService = new FormattingSettingsService();


        Visual.Instance = this;
        
        this.target = options.element;
        this.host = options.host;
        this.selectionManager = options.host.createSelectionManager();
        this.updateCount = 0;

        Visual.Instances.push(this);

        if (document) {
            const new_p: HTMLElement = document.createElement("p");

            this.fileupload = Object.assign(document.createElement('input'),{
                id:'fileInput',
                type: "file", 
                accept: ".ifc",
                style: "visibility:hidden"
            });
            this.fileupload.addEventListener('change', function (e) {
                var file = this.files[0];
                var reader = new FileReader();
                reader.onload = function (e) {
                    //console.log("File content: ", reader.result);

                    //reader.result.toString()
                    Visual.Instance.save(options.host,"internalState", "ifc_file_base64", reader.result.toString());
                    Visual.Instance.save(options.host,"ifcFileDetails", "blob", URL.createObjectURL(file).toString()); //saving file in base 64
                    Visual.Instance.save(options.host,"ifcFileDetails", "fileName", file.name);

                    console.log("saved file: ", file.name);
                    console.log("saved to blob: ", URL.createObjectURL(file).toString().substring(0, 3));
                    //const ifcURL = URL.createObjectURL(file);
                    Visual.Instance.newfileuploaded = true;
                }
                //reader.readAsText(file);
                reader.readAsDataURL(file); //then reader.result.toString() will be base64 encoded
            });
            new_p.appendChild(this.fileupload);

            this.debugElememnt = Object.assign(document.createElement('em'),{
                id:'debugElememnt',
                style: "visibility:hidden"
            });

            this.debugElememnt.appendChild(document.createTextNode("Update count:"));
            this.textNode = document.createTextNode(this.updateCount.toString());
            this.debugElememnt.appendChild(this.textNode);
            new_p.appendChild(this.debugElememnt);

            this.imgElement = Object.assign(document.createElement("img"),{
                style: "max-width: 100%;height: auto"
            });
            new_p.appendChild(this.imgElement);

            this.target.appendChild(new_p);

            this.init();
        }

    }

    private async init(){
        //Scene
        Visual.Instance.scene = new THREE.Scene();
        Visual.Instance.scene.background = new THREE.Color( 0xBBBBBB );

        //Initial cube
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshPhongMaterial( { color: 0xFF0000 } );
        const cube = new THREE.Mesh( geometry, material );
        Visual.Instance.scene.add( cube );

        //Default Camera
        Visual.Instance.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000 );
        Visual.Instance.camera.position.z = -70;
        Visual.Instance.camera.position.y = 25;
        Visual.Instance.camera.position.x = 90;

        //Setup IFC Loader
        Visual.Instance.ifcLoader = new IFCLoader();
        //ifcLoader.crossOrigin = "no-cors";

        //await ifcLoader.ifcManager.setWasmPath( /*this.formattingSettings.dataPointCard.blob.value, true);*/"https://ifcjs.github.io/web-ifc/demo/" );
        //await ifcLoader.ifcManager.setWasmPath( "https://unpkg.com/web-ifc@0.0.40/" );
        //await Visual.Instance.ifcLoader.ifcManager.setWasmPath( "https://unpkg.com/web-ifc@0.0.36/" );

        Visual.Instance.ifcLoader.ifcManager.state.api['isWasmPathAbsolute'] = true;
        Visual.Instance.ifcLoader.ifcManager.state.api['wasmPath'] = "https://unpkg.com/web-ifc@0.0.36/"; //runs no issue
        //Visual.Instance.ifcLoader.ifcManager.state.api['wasmPath'] = "https://unpkg.com/web-ifc/";
        //Visual.Instance.ifcLoader.ifcManager.state.api['wasmPath'] = "https://ifcjs.github.io/web-ifc-viewer/example/files/";  //TypeError: Cannot read properties of undefined (reading 'buffer')
       
        await Visual.Instance.ifcLoader.ifcManager.parser.setupOptionalCategories( {
            [ IFCSPACE ]: false,
        } );
        /*
        await Visual.Instance.ifcLoader.ifcManager.applyWebIfcConfig( {
            USE_FAST_BOOLS: true
        } );
        */
        Visual.Instance.ifcLoader.ifcManager.setupThreeMeshBVH(computeBoundsTree, disposeBoundsTree, acceleratedRaycast);
        

        //Visual.Instance.loadToIfcLoader('https://threejs.org/examples/models/ifc/rac_advanced_sample_project.ifc');
        //Visual.Instance.loadToIfcLoader('https://prod-201.westeurope.logic.azure.com/workflows/39880ddc789e4521840b15d69ed342d8/triggers/manual/paths/invoke/01.ifc?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=lih4oTesyrFesaJTm33iipYzAjb81aeQ7WAspo_-2B8');
        //Visual.Instance.loadToIfcLoader('https://prod-201.westeurope.logic.azure.com/workflows/39880ddc789e4521840b15d69ed342d8/triggers/manual/paths/invoke/MAD_SCIENTIST_212.ifc?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=lih4oTesyrFesaJTm33iipYzAjb81aeQ7WAspo_-2B8');
        
        //Visual.Instance.ifcLoader.load( 'https://prod-201.westeurope.logic.azure.com/workflows/39880ddc789e4521840b15d69ed342d8/triggers/manual/paths/invoke/01.ifc?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=lih4oTesyrFesaJTm33iipYzAjb81aeQ7WAspo_-2B8', function ( model ) {
        //ifcLoader.load( 'https://threejs.org/examples/models/ifc/rac_advanced_sample_project.ifc', function ( model ) {
        //    Visual.Instance.scene.add( model.mesh );
        //    Visual.Instance.render();
        //} );



        //Renderer
        Visual.Instance.renderer = new THREE.WebGLRenderer( { antialias: true } );
        Visual.Instance.renderer.setSize( window.innerWidth, window.innerHeight );
        //Visual.Instance.renderer.setPixelRatio( window.devicePixelRatio );
        //Visual.Instance.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        //Visual.Instance.renderer.shadowMap.enabled = true;
        //Visual.Instance.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        Visual.Instance.target.appendChild( Visual.Instance.renderer.domElement );

        //Controls
        this.controls = new OrbitControls( Visual.Instance.camera, Visual.Instance.renderer.domElement );
        this.controls.addEventListener( 'change', () => {
            //console.log("controls", this.controls);
            Visual.Instance.render();

            
        } );

        window.addEventListener( 'resize', Visual.Instance.onWindowResize );
        
        

        
        //mouse ray cast
        const raycaster = new THREE.Raycaster();
        raycaster.firstHitOnly = true;
        const mouse = new THREE.Vector2();
        function cast(event) {
            // Computes the position of the mouse on the screen
            //const bounds = threeCanvas.getBoundingClientRect();
            const bounds = Visual.Instance.renderer.domElement.getBoundingClientRect();
          
            const x1 = event.clientX - bounds.left;
            const x2 = bounds.right - bounds.left;
            mouse.x = (x1 / x2) * 2 - 1;
          
            const y1 = event.clientY - bounds.top;
            const y2 = bounds.bottom - bounds.top;
            mouse.y = -(y1 / y2) * 2 + 1;
          
            // Places it on the camera pointing to the mouse
            raycaster.setFromCamera(mouse, Visual.Instance.camera);
          
            // Casts a ray
            //console.log("raycaster",raycaster.intersectObjects(Visual.Instance.scene.children ))
            return raycaster.intersectObjects(Visual.Instance.scene.children ); //ifcModels
        }
        function pick(event) {
            const found = cast(event)[0];
            if (found) {
              const index = found.faceIndex;
              const geometry = found.object['geometry'];
              const ifc = Visual.Instance.ifcLoader.ifcManager;
              const id = ifc.getExpressId(geometry, index);

              console.log("ExpressId", id);
              console.log("selected geometry",geometry);        
              console.log("properties", ifc.getPropertySets(0, id, true));

            }
        }
        function hover_highlight(event, material: THREE.MeshLambertMaterial, model, isSelect = false) {
            
            if(Visual.Instance.formattingSettings.dataPointCard.defaultColor.value.value){
                material.color.set(Visual.Instance.formattingSettings.dataPointCard.defaultColor.value.value)
            };

            const castIntersectObjects = cast(event);
            if(castIntersectObjects.length > 0){
                //console.log("castIntersectObjects", castIntersectObjects);
                var found;
                for (const intersectObject of castIntersectObjects){
                    if(intersectObject.object['modelID'] == 0){
                        var index_temp = intersectObject.faceIndex;
                        var geometry_temp = intersectObject.object['geometry'];
                        var expressId_temp = Visual.Instance.ifcLoader.ifcManager.getExpressId(geometry_temp, index_temp);

                        if(/*true || */(
                            Visual.Instance.options?.dataViews?.[0]?.categorical?.categories?.[0]?.values.map(Number).includes(expressId_temp))){//if raycasted object is selected in power bi
                            found = intersectObject;
                            
                            break; //break out of loop after first matched item.
                        }
                    }
                };
            }
            //const found = castIntersectObjects[0];

            
            if (castIntersectObjects.length>0 && found) {

                
                // Gets model ID
                model.id = found.object['modelID'];

                // Gets Express ID
                const index = found.faceIndex;
                const geometry = found.object['geometry'];
                const expressId = Visual.Instance.ifcLoader.ifcManager.getExpressId(geometry, index);
                let pbi_selection_index = Visual.Instance.options?.dataViews?.[0]?.categorical?.categories?.[0]?.values?.map(Number).indexOf(expressId);
                
                const tooltipOptions = {
                    coordinates: [event.clientX, event.clientY],
                    isTouchEvent: event.pointerType === "touch",
                    dataItems: [{displayName: "expressId",value: expressId.toString()}],
                    identities: Visual.Instance.selectionManager.getSelectionIds()
                };
                
                //tooltip
                Visual.Instance.options?.dataViews?.[0]?.categorical?.values?.forEach(measure => {
                    if(measure.source?.displayName?.includes("color") || measure.source?.displayName?.includes("Color")){


                    }else if(measure.values?.[pbi_selection_index] != null && measure.source.type.dateTime){

                        var d = new Date(measure.values?.[pbi_selection_index]?.toString());
                        tooltipOptions.dataItems.push({
                            displayName: measure.source?.displayName?.toString(),
                            value: d.toLocaleDateString("fr-CA")
                        });

                        tooltipOptions.dataItems.push({
                            displayName: "time zone",
                            value: (-1*d.getTimezoneOffset()<=0?"":"+") + (-1*d.getTimezoneOffset()/60).toString()
                        });
                        
                    }else{
                        
                        tooltipOptions.dataItems.push({
                            displayName: measure.source?.displayName?.toString(),
                            value: measure.values?.[pbi_selection_index]?.toString()
                        });
                    }
                    
                    /*
                    if(measure.source.type.dateTime == false){
                        tooltipOptions.dataItems.push({
                            displayName: measure.source?.displayName?.toString(),
                            value: measure.values?.[pbi_selection_index]?.toString()
                        });

                    }else{
                        
                        if(measure.values?.[pbi_selection_index] != null){
                            var d = new Date(measure.values?.[pbi_selection_index]?.toString());
                            tooltipOptions.dataItems.push({
                                displayName: measure.source?.displayName?.toString(),
                                value: d.toLocaleDateString("fr-CA")
                            });

                            tooltipOptions.dataItems.push({
                                displayName: "time zone",
                                value: (-1*d.getTimezoneOffset()<=0?"":"+") + (-1*d.getTimezoneOffset()/60).toString()
                            });
                        }else{
                            
                            tooltipOptions.dataItems.push({
                                displayName: measure.source?.displayName?.toString(),
                                value: ""
                            });
                        }
                    }
                    */
                });

                Visual.Instance.host.tooltipService.show(tooltipOptions);

                if(isSelect){
                    selectObject(model.id,expressId);
                }
                // Creates subset
                Visual.Instance.ifcLoader.ifcManager.createSubset({
                    modelID: model.id,
                    ids: [expressId],
                    material: material,
                    scene: Visual.Instance.scene,
                    removePrevious: true,
                });
            } else {
                // Removes previous highlight
                if(isSelect){
                    Visual.Instance.selectionManager.clear();
                    console.log("castIntersectObjects",castIntersectObjects);
                }
                Visual.Instance.ifcLoader.ifcManager.removeSubset(model.id, material);
                
            }
            Visual.Instance.render();
        }

        async function click_highlight(event, material: THREE.MeshLambertMaterial, model, isSelect = false) {


            const castIntersectObjects = cast(event);
            var found;
            for (const intersectObject of castIntersectObjects){
                if(intersectObject.object['modelID'] == 0){
                    var index_temp = intersectObject.faceIndex;
                    var geometry_temp = intersectObject.object['geometry'];
                    var expressId_temp = Visual.Instance.ifcLoader.ifcManager.getExpressId(geometry_temp, index_temp);
                    
                    
                    if(true || Visual.Instance.options.dataViews[0] &&
                        Visual.Instance.options.dataViews[0].categorical &&
                        Visual.Instance.options.dataViews[0].categorical.categories[0] &&
                        Visual.Instance.options.dataViews[0].categorical.categories[0].values.map(Number).includes(expressId_temp)){//if raycasted object is selected in power bi
                        found = intersectObject;
                        //console.log("scene",Visual.Instance.scene);
                        //console.log("found_object",found);
                        console.table( await Visual.Instance.ifcLoader.ifcManager.getPropertySets(intersectObject.object['modelID'],expressId_temp,true));

                        break; //break out of loop after first matched item.
                    }
                }
            };

            //const found = castIntersectObjects[0];

            
            if (castIntersectObjects.length>0 && found) {
                // Gets model ID
                model.id = found.object['modelID'];

                // Gets Express ID
                const index = found.faceIndex;
                const geometry = found.object['geometry'];
                const expressId = Visual.Instance.ifcLoader.ifcManager.getExpressId(geometry, index);
                
                Visual.Instance.ifcLoader.ifcManager.getPropertySets(0,expressId);
                //let pbi_selection_index = Visual.Instance.options?.dataViews?.[0]?.categorical?.categories?.[0]?.values?.map(Number).indexOf(expressId);
                /*
                const tooltipOptions = {
                    coordinates: [event.clientX, event.clientY],
                    isTouchEvent: event.pointerType === "touch",
                    dataItems: [{displayName: "expressId",value: expressId.toString()}],
                    identities: Visual.Instance.selectionManager.getSelectionIds()
                };

                Visual.Instance.options?.dataViews?.[0]?.categorical?.values?.forEach(measure => {
                    tooltipOptions.dataItems.push({
                        displayName: measure.source?.displayName?.toString(),
                        value: measure.values?.[pbi_selection_index]?.toString()
                    });
                });

                Visual.Instance.host.tooltipService.show(tooltipOptions);
                */

            } else {

            }
            Visual.Instance.render();
        }


        async function selectObject(modelId, expressId){
            console.log("ExpressId", expressId);
            console.log("properties", await Visual.Instance.ifcLoader.ifcManager.getPropertySets(modelId, expressId, true));
            //Visual.Instance.ifcLoader.ifcManager.get
            
            //update power bi selection
            var category = Visual.Instance.options.dataViews[0].categorical.categories[0];
            //var data = CustomVisual.Instance.options.dataViews[0].categorical.values.find(x => x.source.roles.data);
            var selection = Visual.Instance.host.createSelectionIdBuilder().withCategory(category, category.values.indexOf(expressId))
            Visual.Instance.selectionManager.select( selection );
        }

        const selectMat = new THREE.MeshLambertMaterial({
            transparent: true,
            opacity: 0.6,
            color: 0xff00ff,
            depthTest: false,
        });
        const hoverMat = new THREE.MeshLambertMaterial({
            transparent: true,
            opacity: 0.6,
            color: 0xee8DFF,
            depthTest: false
          });

        //window.ondblclick  = (event) => highlight(event, selectMat, { id: 0 }, true);
        window.onclick     = (event) => click_highlight(event, hoverMat, { id: 0 }, false);
        window.onmousemove = (event) => hover_highlight(event, hoverMat, { id: 0 }, false); //highlightModel);

        Visual.Instance.render();
       
        Visual.Instance.host.persistProperties({
            merge: [
                {
                    objectName: "model",
                    selector: undefined,
                    properties: {
                        //url: path
                    }
                }
            ]
        });
    }

    private loadToIfcLoader(path){
        //clear scene
        Visual.Instance.scene.clear();

        //grid
        //const grid = new THREE.GridHelper(50, 30);
        //Visual.Instance.scene.add(grid);

        //const targetObject = new THREE.Object3D();
        //this.scene.add(targetObject);

        //Lights
        const directionalLight1 = new THREE.DirectionalLight( 0xffeeff, 0.8 );
        directionalLight1.position.set( 1, 1, 1 );
        Visual.Instance.scene.add( directionalLight1 );
        
        const directionalLight2 = new THREE.DirectionalLight( 0xffffff, 0.8 );
        directionalLight2.position.set( - 1, 0.5, - 1 );
        Visual.Instance.scene.add( directionalLight2 );

        const ambientLight = new THREE.AmbientLight( 0xffffee, 0.25 );
        Visual.Instance.scene.add( ambientLight );

        Visual.Instance.ifcLoader.ifcManager.parser.setupOptionalCategories({
            [IFCSPACE]: false,
            [IFCOPENINGELEMENT]: false
          });
        const settings = Visual.Instance.ifcLoader.ifcManager.state.webIfcSettings;
        const fastBools = (settings === null || settings === void 0 ? void 0 : settings.USE_FAST_BOOLS) || true;
        const coordsToOrigin = (settings === null || settings === void 0 ? void 0 : settings.COORDINATE_TO_ORIGIN) || false;
        Visual.Instance.ifcLoader.ifcManager.applyWebIfcConfig({
            COORDINATE_TO_ORIGIN: true, //coordsToOrigin,
            USE_FAST_BOOLS: fastBools
        });
        Visual.Instance.ifcLoader.load( path, async function ( model ) {
        //Visual.Instance.ifcLoader.load( 'https://prod-201.westeurope.logic.azure.com/workflows/39880ddc789e4521840b15d69ed342d8/triggers/manual/paths/invoke/01.ifc?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=lih4oTesyrFesaJTm33iipYzAjb81aeQ7WAspo_-2B8', function ( model ) {
        //ifcLoader.load( 'https://threejs.org/examples/models/ifc/rac_advanced_sample_project.ifc', function ( model ) {
            model.visible = false;
            model.modelID = 0;

            const modelCopy = new THREE.Mesh(
                model.geometry,
                new THREE.MeshBasicMaterial({
                  transparent: true,
                  opacity: 0.5,
                  //transmission: 0.5,
                  //depthTest: false
                  color: 0xAAAAAA,
                  side:2
                })
            );

            
            //const modelCopyEdges = new THREE.EdgesGeometry( model.geometry ); 
            
            const modelCopyLine = new THREE.LineSegments(
                new THREE.EdgesGeometry( model.geometry ), 
                new THREE.LineBasicMaterial( { 
                    color: 0x444444,
                    linewidth: 5,
                    opacity: 0.1,
                } ) 
            ); 
            
           /*
            if(Array.isArray(model.material)) model.material.forEach(mat => {
                mat.side = 2;
                mat.depthTest = false;
                //mat.wireframe = true;
            });   
            */
            console.log("model", model);
            console.log("camera", Visual.Instance.camera);
            Visual.Instance.scene.add( model ); //model.mesh is deprecated, just use model // model.id = 0 for selection layer
            //Visual.Instance.scene.add( modelCopy ); //duplicating model // model.id = 1 for coloring layer
            
            //Visual.Instance.scene.add( modelCopyLine );

            //model.geometry.computeBoundingSphere();
            //Visual.Instance.camera.position.setScalar(0.5*window.innerHeight/(model.geometry.boundingSphere.radius*2));
            //Visual.Instance.camera.lookAt( model.position );
            
            Visual.Instance.render();

            Visual.Instance.newfileuploaded = false;

            // Force an update after asyncronous load
            if (Visual.Instance.options != undefined) // which means that the fisrt "update" has already happened before the model asyncoronously loaded
            {   
                console.log(Visual.Instance.options);
                Visual.Instance.update(Visual.Instance.options); // we call update again to assign colors to the scene objects
            }

            Visual.Instance.formattingSettings.ifcFileCard.showUploadIcon.value = false;
            //Visual.Instance.save(Visual.Instance.host, "ifcFileDetails", "showUploadIcon", "false");
            //this.fileupload.style.visibility = "hidden";

            if(Visual.Instance.options.dataViews[0].metadata.objects.hasOwnProperty("cameraSettingsObject") &&
            Visual.Instance.options.dataViews[0].metadata.objects.cameraSettingsObject.hasOwnProperty("cameraObjString") &&
            Visual.Instance.options.dataViews[0].metadata.objects.cameraSettingsObject.hasOwnProperty("controlTargetString") &&
            Visual.Instance.options.dataViews[0].metadata.objects.cameraSettingsObject.cameraObjString.toString().length > 0 &&
            Visual.Instance.options.dataViews[0].metadata.objects.cameraSettingsObject.controlTargetString.toString().length > 0){

                //camera
                Visual.Instance.camera.matrix.fromArray(JSON.parse(
                    Visual.Instance.options.dataViews[0].metadata.objects.cameraSettingsObject.cameraObjString.toString()
                ));
                Visual.Instance.camera.matrix.decompose(
                    Visual.Instance.camera.position, 
                    Visual.Instance.camera.quaternion, 
                    Visual.Instance.camera.scale
                ); 
                //control
                Visual.Instance.controls.target.fromArray(JSON.parse(
                    Visual.Instance.options.dataViews[0].metadata.objects.cameraSettingsObject.controlTargetString.toString()
                ));

                console.log("loaded camera");
                Visual.Instance.save(Visual.Instance.host, "cameraSettings", "camera_load", "false");
                
            }

            Visual.Instance.render();
        } );
        
        console.log("scene", Visual.Instance.scene);
        console.log("ifcLoader", Visual.Instance.ifcLoader);
        console.log("camera", Visual.Instance.camera);
        //Visual.Instance.selectionManager.clear();
        Visual.Instance.render();

    }

    private onWindowResize() {

        Visual.Instance.camera.aspect = window.innerWidth / window.innerHeight;
        Visual.Instance.camera.updateProjectionMatrix();
        Visual.Instance.renderer.setSize( window.innerWidth, window.innerHeight );
        Visual.Instance.render();
    
    }

    private render() {
    
        Visual.Instance.renderer.render( Visual.Instance.scene, Visual.Instance.camera );
    
    }


    public update(options: VisualUpdateOptions) {
        console.log("updateCount",this.updateCount);
        this.options = options;
        let dataView: DataView = options.dataViews[0];
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews);


        if (this.textNode) {
            this.textNode.textContent = (this.updateCount++).toString() + " newfile?: " + (this.newfileuploaded).toString();
            this.target.style.color = this.formattingSettings.dataPointCard.defaultColor.value.value;
            this.target.style.backgroundColor= this.formattingSettings.dataPointCard.fill.value.value;
            this.target.style.fontSize = this.formattingSettings.dataPointCard.fontSize.value.toString()+"px";

        }

        if(Visual.Instance.scene){
            //update ifc model
            Visual.Instance.scene.background = new THREE.Color( this.formattingSettings.dataPointCard.fill.value.value );

            //update model file
            if( (this.updateCount <= 1 || this.newfileuploaded )&&
                dataView.metadata.hasOwnProperty("objects") &&
                dataView.metadata.objects.hasOwnProperty("internalState") &&
                dataView.metadata.objects.internalState.hasOwnProperty("ifc_file_base64") &&
                dataView.metadata.objects.internalState.ifc_file_base64.toString().length>0){

                    const blob_content = Visual.Instance.dataURItoBlob(dataView.metadata.objects.internalState.ifc_file_base64.toString());
                    const blob_address = URL.createObjectURL(blob_content).toString();
                    Visual.Instance.loadToIfcLoader(blob_address);
                


            }

            // update selection
            if( dataView &&
                dataView.categorical &&
                dataView.categorical.categories &&
                dataView.categorical.categories[0].source){   

                    while(Visual.Instance.scene.children.length>4){
                        Visual.Instance.scene.children.pop();
                    }
                    //Visual.Instance.ifcLoader.ifcManager.clearSubset(0);
                    Visual.Instance.ifcLoader.ifcManager.subsets['subsets'] = {};

                    

                    if( dataView.categorical.values &&
                        dataView.categorical.values[0].source){

                        let measureListUnique =  [...new Set(dataView.categorical.values[0].values)];
                        var correspondingExpressIds = [];

                        let maxColor = new THREE.Color( this.formattingSettings.dataPointCard.maxColor.value.value );
                        let midColor = new THREE.Color( this.formattingSettings.dataPointCard.midColor.value.value );
                        let minColor = new THREE.Color( this.formattingSettings.dataPointCard.minColor.value.value );
                        var thisGroupColor = new THREE.Color( 0x000000 );
                        for (var i = 0; i< measureListUnique.length; i++){
                            correspondingExpressIds.push([]);
                            for (var j = 0; j< dataView.categorical.values[0].values.length; j++){
                                if( measureListUnique[i] == dataView.categorical.values[0].values[j] ){
                                    correspondingExpressIds[i].push(dataView.categorical.categories[0].values[j]);
                                }
                            }
                            
                            //assign colors
                            
                            // check if value is a valid color
                            if( /^#([0-9A-F]{3}){1,2}$/i.test( measureListUnique[i].toString()) ||
                                measureListUnique[i].toString().startsWith( "hsl(") || 
                                measureListUnique[i].toString().startsWith("hsla(") ||
                                measureListUnique[i].toString().startsWith( "rgb(") ||
                                measureListUnique[i].toString().startsWith("rgba(") 
                            ){ 
                                thisGroupColor.set(new THREE.Color(measureListUnique[i].toString()));
                            }
                            // otherwise treat it as X11 color name
                            else if(dataView.categorical.values[0].source.displayName.toString().includes("color") || 
                                    dataView.categorical.values[0].source.displayName.toString().includes("Color")){

                                thisGroupColor.setColorName(measureListUnique[i].toString());
                                
                            }else if(measureListUnique.length == 1){
                                thisGroupColor = midColor;
                            }else{
                                var colorScalar = 1;

                                // if measure is number
                                if(dataView.categorical.values[0].minLocal && dataView.categorical.values[0].maxLocal){ 
                                    var minLocal = Number(dataView.categorical.values[0].minLocal);
                                    var maxLocal = Number(dataView.categorical.values[0].maxLocal);
                                    var thisMeasureValue = Number(measureListUnique[i]);
                                    var ratioK = (thisMeasureValue - minLocal)/(maxLocal - minLocal);
                                    
                                    if(  thisMeasureValue > (maxLocal + minLocal)/2){
                                        thisGroupColor.setRGB(
                                            colorScalar*((2*ratioK-1)*(maxColor.r - midColor.r) + midColor.r),
                                            colorScalar*((2*ratioK-1)*(maxColor.g - midColor.g) + midColor.g),
                                            colorScalar*((2*ratioK-1)*(maxColor.b - midColor.b) + midColor.b)
                                        );
                                    }else{
                                        thisGroupColor.setRGB(
                                            colorScalar*((2*ratioK)*(midColor.r - minColor.r) + minColor.r),
                                            colorScalar*((2*ratioK)*(midColor.g - minColor.g) + minColor.g),
                                            colorScalar*((2*ratioK)*(midColor.b - minColor.b) + minColor.b)
                                        );
                                    }
                 
                                }
                                //if measure is text
                                else{  
                                    var ratioK = i/(measureListUnique.length-1);
                                    if( i > (measureListUnique.length-1) /2 ){
                                        thisGroupColor.setRGB(
                                            colorScalar*((2*ratioK-1)*(maxColor.r - midColor.r) + midColor.r),
                                            colorScalar*((2*ratioK-1)*(maxColor.g - midColor.g) + midColor.g),
                                            colorScalar*((2*ratioK-1)*(maxColor.b - midColor.b) + midColor.b)
                                        );
                                    }else{
                                        thisGroupColor.setRGB(
                                            colorScalar*((2*ratioK)*(midColor.r - minColor.r) + minColor.r),
                                            colorScalar*((2*ratioK)*(midColor.g - minColor.g) + minColor.g),
                                            colorScalar*((2*ratioK)*(midColor.b - minColor.b) + minColor.b)
                                        );
                                    }
                                }
                                
                            }
                            
                            //console.log("correspondingExpressIds[i]",correspondingExpressIds[i]);
                            
                            //Visual.Instance.ifcLoader.ifcManager.subsets.clearSubset(1);    
                            Visual.Instance.ifcLoader.ifcManager.createSubset({
                                //customID: i.toString(),
                                modelID: 0,
                                ids: correspondingExpressIds[i].map(Number), // map changes string to number
                                material: 
                                new THREE.MeshLambertMaterial({
                                    transparent: true,
                                    opacity: 0.8,
                                    color: thisGroupColor//0x77aaff,
                                }),
                                scene: Visual.Instance.scene,
                                removePrevious: true,
                            });
                            
                        }
                        
                    }else{                    
                        Visual.Instance.ifcLoader.ifcManager.createSubset({
                        //customID: "123",
                        modelID: 0,
                        ids: dataView.categorical.categories[0].values.map(Number), // map changes string to number
                        material: undefined,
                        /*new THREE.MeshLambertMaterial({
                            transparent: true,
                            opacity: 0.8,
                            color: 0x77aaff,
                        }),*/
                        scene: Visual.Instance.scene,
                        removePrevious: true,
                    });}


                    Visual.Instance.render();


            }


        }





        if(this.formattingSettings.ifcFileCard.showUploadIcon.value && this.fileupload.style.visibility == "hidden"){
            this.fileupload.style.visibility = "visible";
            this.debugElememnt.style.visibility = "visible";
        }else if(!this.formattingSettings.ifcFileCard.showUploadIcon.value && this.fileupload.style.visibility == "visible"){
            this.fileupload.style.visibility = "hidden";
            this.debugElememnt.style.visibility = "hidden";
        }

        if( (this.updateCount <= 1 || this.formattingSettings.cameraCard.camera_load.value == true) &&
            this.options &&
            this.options.dataViews &&
            this.options.dataViews[0] &&
            this.options.dataViews[0].metadata &&
            this.options.dataViews[0].metadata.objects &&
            this.options.dataViews[0].metadata.objects.cameraSettingsObject &&
            this.options.dataViews[0].metadata.objects.cameraSettingsObject.cameraObjString &&
            this.options.dataViews[0].metadata.objects.cameraSettingsObject.controlTargetString){

                //camera
                this.camera.matrix.fromArray(JSON.parse(
                    dataView.metadata.objects.cameraSettingsObject.cameraObjString.toString()
                ));
                this.camera.matrix.decompose(
                    this.camera.position, 
                    this.camera.quaternion, 
                    this.camera.scale
                ); 
                //control
                this.controls.target.fromArray(JSON.parse(
                    dataView.metadata.objects.cameraSettingsObject.controlTargetString.toString()
                ));

                console.log("loaded camera");
                this.save(this.host, "cameraSettings", "camera_load", "false");

        }else if(this.formattingSettings.cameraCard.camera_save.value == true){
            //camera
            this.camera.matrix.compose(this.camera.position, this.camera.quaternion, this.camera.scale); 
            this.save(this.host, "cameraSettingsObject", "cameraObjString", JSON.stringify(this.camera.matrix.toArray()));
            //control
            this.save(this.host, "cameraSettingsObject", "controlTargetString", JSON.stringify(this.controls.target.toArray()));

            
            this.save(this.host, "cameraSettings", "camera_save", "false");
        } 

        this.render();
    }
    
    /**
     * Returns properties pane formatting model content hierarchies, properties and latest formatting values, Then populate properties pane.
     * This method is called once every time we open properties pane or when the user edit any format property. 
     */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        //console.log(this.formattingSettings);
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
/*
    public updateFormattingModel(arrayOfMeasures: Array): powerbi.visuals.FormattingModel {
        console.log();
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    this.formattingSettings.cards.push(new formattingSettings.cards)
        VisualFormattingSettingsModel.

        {
            "name": "fill",
            "displayName": "Background color",
            "value": {
                "value": "#e6e6e6"
            },
            "type": "ColorPicker"
        }

    }
*/
    private save(host: IVisualHost, objectName: string, key:string, value: string) {
        var obj={};
        obj[key]=value || "";
        host.persistProperties(<powerbi.VisualObjectInstancesToPersist>{
            merge: [{
                objectName: objectName ,
                selector: null,
                properties: obj
            }]
        });
        console.log("saved to", objectName, "\n{", key, ":", value, "}"  );
    }

    private dataURItoBlob(dataURI: string) {
        // convert base64/URLEncoded data component to raw binary data held in a string
        var byteString;
        if (dataURI.split(',')[0].indexOf('base64') >= 0)
            byteString = atob(dataURI.split(',')[1]);
        else
            byteString = unescape(dataURI.split(',')[1]);
    
        // separate out the mime component
        var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    
        // write the bytes of the string to a typed array
        var ia = new Uint8Array(byteString.length);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
    
        return new Blob([ia], {type:mimeString});
    }    
    
    
}
