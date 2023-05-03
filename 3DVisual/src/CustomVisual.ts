/// <amd-dependency path='three'>

/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of me software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and me permission notice shall be included in
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

//import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import IViewport = powerbi.IViewport;

import isUUID from 'validator/lib/isUUID';

// Import React dependencies and the added component
import * as React from "react";
import * as ReactDOM from "react-dom";
import { UploadForm, initialState } from "./component";

import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import { VisualSettings } from "./settings";
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;

import * as THREE from 'three';
// import { Rhino3dmLoader } from 'three/examples/jsm/loaders/3DMLoader.js';
import { IFCLoader } from 'three/examples/jsm/loaders/IFCLoader.js';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Color, Material, MeshBasicMaterial, MeshDepthMaterial, MeshPhongMaterial, SphereGeometry } from "three";
import { isDeepStrictEqual } from "util";


/**
 * Interface for data points.
 *
 * @interface
 * @property {number} value    - Data value for point.
 * @property {string} category - Coresponding category of data value.
 * @property {string} color    - Color corresponding to data point.
 */
interface ChartDataPoint {
    value: number;
    category: string;
    id: string;
    color: THREE.Color;
};

export class CustomVisual implements IVisual {
    // ...
    public host: IVisualHost;
    private options: VisualUpdateOptions; // so we cann call update from the constructor when the model is loaded
    private selectionManager: ISelectionManager;
    static Config = {
        default_color: new Color('#808080'),
        opacity_of_unselected_objects: 0.3,
        color1: new Color('#00FF00'),
        color2: new Color('#FFFF00'),
        color3: new Color('#FF0000'),
        solidMaterial: new THREE.MeshPhongMaterial({ color: 0x999999 })
    };
    
    private visualSettings: VisualSettings;
    // ...

    //private target: HTMLElement;
    private updateCount: number;
    private textNode: Text;
    public scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls
    private model_loaded: boolean = false
    public upload_form: UploadForm;

    private target: HTMLElement;
    private reactRoot: React.ComponentElement<any, any>;

    public static Instance: CustomVisual;
    private constructor_options: VisualConstructorOptions;

    private first_load: boolean = true;
    private path: string;
    public static Instances: CustomVisual[] = [];


    constructor(options: VisualConstructorOptions) {
        this.constructor_options = options;
        CustomVisual.Instance = this;

        this.target = options.element;
        this.selectionManager = options.host.createSelectionManager();

        this.first_load = true;
        CustomVisual.Instances.push(this);

    }

    private _construct_three_scene(options: VisualConstructorOptions) {
        try {
            THREE.Object3D.DefaultUp = new THREE.Vector3(0, 1, 0);

            this.host = options.host;

            //this.scene = new THREE.Scene();

            this.target = options.element;
            this.updateCount = 0;
            this.scene = new THREE.Scene();
            //CustomVisual.Instance.visualSettings.model.bgColor = "#999999";
            this.scene.background = new THREE.Color( "#999999" );
            
            this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
            this.renderer = new THREE.WebGLRenderer();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            // Orbit controls
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            //this.controls.enablePan = false;    
            this.controls.addEventListener('change', () => {
                if (this.options != undefined) // if all required parameters (rhino IDs) have been loaded, otherwise don't render anything
                {
                    this.renderer.render(this.scene, this.camera);
                }
            });


            if (document) {
                this.scene.updateMatrixWorld(true);
                this.target.appendChild(this.renderer.domElement);
            }
        }
        catch (e) {
            console.error(e);
            UploadForm.update_loading_form(e);
            throw e;
        }

    }

    public static Load3DModel(path: string) {
        CustomVisual.Instance.selectionManager.clear();
        // Hide input form
        if (CustomVisual.Instance.visualSettings.model.url == "") {
            UploadForm.hide_input_form();
        }

        // Check loading an existing model
        var existing_model: boolean = false;
        if (CustomVisual.Instance.visualSettings.model.url != "") {
            existing_model = true;
        }

        // Create Rhino loader
        //const loader = new Rhino3dmLoader();
        //loader.setLibraryPath( 'https://cdn.jsdelivr.net/npm/rhino3dm@7.11.1/' );
        const loader = new IFCLoader();
        //loader.ifcManager.setWasmPath('https://threejs.org/examples/jsm/loaders/ifc/'); // this is no longer available
        loader.ifcManager.setWasmPath('https://unpkg.com/web-ifc@0.0.36/'); //todo: host "web-ifc.wasm" somewhere else or put have the user define it in visual formats 
        //onload call function
        loader.load(
            // resource URL
            path,
            // called when the resource is loaded
            function (object) {
                // Hide input form
                if (CustomVisual.Instance.visualSettings.model.url == "") {
                    UploadForm.hide_loading_form();
                }

                
                CustomVisual.Instance._construct_three_scene(CustomVisual.Instance.constructor_options);
                //change materil
                /*
                if(Array.isArray(object.material)){
                    for(let i=0; i<object.material.length; i++){
                        object.material[i].transparent= true;
                        object.material[i].opacity= 0.1;
                        //object.material[i].color.set("#77aaff");
                    }
                }
                */
               // Add IFC model to scene
                CustomVisual.Instance.scene.add(object);



                //Add dummy model to scene
                //object.visible = false;
                /*
                const modelCopy = new THREE.Mesh(
                  object.geometry,
                  new THREE.MeshLambertMaterial({
                    transparent: true,
                    opacity: 0.1,
                    color: 0x77aaff,
                  })
                );
                CustomVisual.Instance.scene.add(modelCopy);
                */

                // Try to set camera
                var bb = new THREE.Box3();
                bb.setFromObject(object);
                CustomVisual.Instance.setCamera(bb);
                CustomVisual.Instance.model_loaded = true;
                CustomVisual.Instance.first_load = false;

                // Force an update after asyncronous load
                if (CustomVisual.Instance.options != undefined) // which means that the fisrt "update" has already happened before the model asyncoronously loaded
                {
                    CustomVisual.Instance.update(CustomVisual.Instance.options); // we call update again to assign colors to the scene objects
                }
                // Save URL in properties of custom visual
                const instance: VisualObjectInstance = {
                    objectName: "model",
                    selector: undefined,
                    properties: {
                        url: path
                    }
                }
                CustomVisual.Instance.host.persistProperties({
                    merge: [
                        instance
                    ]
                });
            },// called as loading progresses
            function (xhr) {
                var loading_progress: string = "";
                if (CustomVisual.Instance.visualSettings.model.url != "") // if we're reloading don't show message
                {
                    return;
                }
                if (xhr.total != 0 && xhr.total != undefined) {
                    loading_progress = (Math.round((xhr.loaded / xhr.total * 100) * 1) / 1).toString() + "%";
                }
                UploadForm.update_loading_form(loading_progress);
            },
            // called when loading has errors
            function (error) {
                // Show form if error was returned
                UploadForm.show_error_message('An error happened: ' + (error));
            }
        );
        // for debugging
        console.log(CustomVisual.Instance);
        console.log(loader);

        //onselect
        const highlightMaterial = new THREE.MeshPhongMaterial({ color: CustomVisual.Instance.visualSettings.model.selectColor, depthTest: false, transparent: true, opacity: 0.3 });
        function selectObject(event) {
            highlightMaterial.color.set(CustomVisual.Instance.visualSettings.model.selectColor);
            //CustomVisual.Instance.selectionManager.clear();

            if (event.button != 0) {
                return;
            }

            const mouse = new THREE.Vector2();
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, CustomVisual.Instance.camera);

            const intersected = raycaster.intersectObjects(CustomVisual.Instance.scene.children, false);
            console.log(intersected);
            
            var selected_mesh = loader.ifcManager.getSubset(0,highlightMaterial);

            if (intersected.length>0) {
                const found = intersected[0];
                const faceIndex = found.faceIndex;
                if (faceIndex>0){
                    //grab intersected id
                    const geometry = found.object['geometry'];
                    const id = loader.ifcManager.getExpressId(geometry, faceIndex);
                    //check if intersected id is already selected mesh
                    //if so, toggle visibility
                    if(selected_mesh != undefined && id == selected_mesh['geometry'].attributes.expressID.array[0] ){
                        selected_mesh.visible = !selected_mesh.visible;
                    }

                    //create new subset
                    const modelID = found.object['modelID'];
                    //if (modelID == 0){
                    loader.ifcManager.createSubset({ modelID: 0, ids: [id], scene: CustomVisual.Instance.scene, removePrevious: true, material: highlightMaterial });
                    const props = loader.ifcManager.getItemProperties(/*modelID*/ 0 , id, true);
                    console.log(props);
                    CustomVisual.Instance.renderer.render(CustomVisual.Instance.scene, CustomVisual.Instance.camera);

                    //update power bi selection
                    var category = CustomVisual.Instance.options.dataViews[0].categorical.categories.find(x => x.source.roles.id);
                    //var data = CustomVisual.Instance.options.dataViews[0].categorical.values.find(x => x.source.roles.data);
                    var selection = CustomVisual.Instance.host.createSelectionIdBuilder().withCategory(category, category.values.indexOf(id))
                    CustomVisual.Instance.selectionManager.select( selection );
                    //}
                }  
            }else{
                //hide selected subset
                if(selected_mesh != undefined){
                    selected_mesh.visible = false;
                    CustomVisual.Instance.renderer.render(CustomVisual.Instance.scene, CustomVisual.Instance.camera);
                }
                
                //clear powerbi selection
                CustomVisual.Instance.selectionManager.clear();
            }

        }
        const hoverHighlightMaterial = new THREE.MeshPhongMaterial({ color: CustomVisual.Instance.visualSettings.model.hoverColor, depthTest: false, transparent: true, opacity: 0.3 });
        function highlightObject(event) {
            hoverHighlightMaterial.color.set(CustomVisual.Instance.visualSettings.model.hoverColor);
            if (event.button != 0) {
                return;
            }
            const mouse = new THREE.Vector2();
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, CustomVisual.Instance.camera);

            const intersected = raycaster.intersectObjects(CustomVisual.Instance.scene.children, false);

            var selected_mesh = loader.ifcManager.getSubset(0,hoverHighlightMaterial);
            
            if (intersected.length>0) {
                const found = intersected[0];
                const faceIndex = found.faceIndex;
                if (faceIndex>0){
                    const geometry = found.object['geometry'];
                    const id = loader.ifcManager.getExpressId(geometry, faceIndex);

                    //create new subset
                    const modelID = found.object['modelID'];
                    loader.ifcManager.createSubset({ modelID: 0, ids: [id], scene: CustomVisual.Instance.scene, removePrevious: true, material: hoverHighlightMaterial });
                    
                    CustomVisual.Instance.renderer.render(CustomVisual.Instance.scene, CustomVisual.Instance.camera);
                }  
            }else{
                if(selected_mesh != undefined){
                    selected_mesh.visible = false;
                    CustomVisual.Instance.renderer.render(CustomVisual.Instance.scene, CustomVisual.Instance.camera);
                }
            }

        }
        //window.onpointerdown = selectObject;
        window.onmousemove = highlightObject;
        window.ondblclick = selectObject;
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        try {
            let objectName = options.objectName;
            let objectEnumeration: VisualObjectInstance[] = [];
            switch (objectName) {
                case 'model':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            url: this.visualSettings.model.url,
                            bgColor: this.visualSettings.model.bgColor,
                            hoverColor: this.visualSettings.model.hoverColor,
                            selectColor: this.visualSettings.model.selectColor,
                        },
                        selector: null
                    });
            };
            return objectEnumeration;
        }
        catch (e) {
            console.error(e);
            throw e;
        }
    }



    public update(options: VisualUpdateOptions) {
        try {
            this.options = options; // so we cann call update from the constructor when the model is loaded
            let dataView: DataView = options.dataViews[0];
            this.visualSettings = VisualSettings.parse<VisualSettings>(dataView);

            var URL_to_load = "";
            // Load model if URL saved from previous use?
            if (!this.model_loaded) {
                if(this.visualSettings.model.url == "" &&
                    dataView.categorical && 
                    dataView.categorical.values &&
                    dataView.categorical.values[0].source &&
                    dataView.categorical.values[0].source.roles && 
                    dataView.categorical.values[0].source.roles.link && 
                    this.first_load){

                    //file url from power query
                    URL_to_load = dataView.categorical.values.find(x => x.source.roles.link).values[0].toString();
                    console.log("dataView.categorical.values.source.roles.link");
                    console.log(URL_to_load);
                    CustomVisual.Load3DModel(URL_to_load);

                    this.first_load = false;

                }else if (this.visualSettings.model.url != "" && this.first_load) // The first load check is extremely important, otherwise the loader will be called twice and the render will freeze
                {
                    //this.selectionManager.clear();

                    
                    //file url from visual settings
                    //CustomVisual.Load3DModel(this.visualSettings.model.url);
                    URL_to_load = this.visualSettings.model.url;
                    console.log("this.visualSettings.model.url");
                    console.log(URL_to_load);
                    CustomVisual.Load3DModel(URL_to_load);


                    //concat rows to construct IFC file
                    /*
                    //let tempBlob = new Blob([dataView.categorical.values.find(x => x.source.roles.link).values.join('\n')]); //concat all rows
                    let tempBlob = new Blob([dataView.categorical.values.find(x => x.source.roles.link).values[0].toString()]); //use only the first row
                    let tempurl = URL.createObjectURL(tempBlob);
                    //let tempurl = dataView.categorical.values.find(x => x.source.roles.link).values[0].toString();
                    if(tempurl.length){
                        this.visualSettings.model.url = tempurl;
                    }else{
                        tempurl = this.visualSettings.model.url;
                    }
                    CustomVisual.Load3DModel(tempurl);
                    */
                    //CustomVisual.Instance.scene.background = new THREE.Color( this.visualSettings.model.bgColor );

                    this.first_load = false;
                }else if (this.first_load) {
                    // Create form to input URL. If there's already a URL defined and we're reloading the model, no input form is created, because it leads to a bug.
                    this.reactRoot = React.createElement(UploadForm, {});
                    ReactDOM.render(this.reactRoot, this.target);
                    this.first_load = false;
                    return;
                } else {
                    return;
                }
            }else{
                
                CustomVisual.Instance.scene.background = new THREE.Color( this.visualSettings.model.bgColor );


            }
        } catch (e) {
            console.error(e);
            UploadForm.show_error_message(e);
            throw e;
        }
        // Return if no model available
        if (!this.model_loaded || this.scene == undefined) // the load model process is asyncronous so we need another if
        {
            return;
        }
        // Update 3D visualization

        try {
            if (this.scene.children[2] != undefined) // beacuse of the asyncronous load process
            {
                this.visualTransform(options, this.host);
            }
            this.renderer.setClearColor(0xffffff, 0);
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            //this.renderer.render(this.scene,this.camera);
            CustomVisual.Instance.renderer.render(this.scene, this.camera);
            // if (this.textNode) {
            //     this.textNode.textContent = (this.updateCount++).toString();    
            // }
        }
        catch (e) {
            console.error(e);
            UploadForm.show_error_message(e);
            throw e;
        }



    }

    private setCamera(scene_box: THREE.Box3) {
        var coeff = 10;//1.5;

        var box_size = scene_box.getSize(new THREE.Vector3());
        //var distance = coeff*Math.max(box_size.x ,box_size.y)/2;
        var distance = coeff * 0.25 * Math.sqrt(box_size.x * box_size.x + box_size.y * box_size.y);
        var box_center = scene_box.getCenter(new THREE.Vector3())
        this.camera.position.x = box_center.x + distance;
        this.camera.position.y = box_center.y + distance;
        this.camera.position.z = box_center.z + 0.5 * Math.sqrt(box_size.x * box_size.x + box_size.y * box_size.y);// + coeff*box_size.z/2;
        this.camera.lookAt(box_center);
        this.camera.updateProjectionMatrix();
        this.controls.target.set(box_center.x, box_center.y, box_center.z);

        // Add directional lighting to cast shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        //directionalLight.position.set(this.camera.position.x, this.camera.position.y, this.camera.position.z);
        directionalLight.position.set(this.camera.position.x, this.camera.position.y, scene_box.max.z * coeff);
        const targetObject = new THREE.Object3D();
        this.scene.add(targetObject);
        directionalLight.target = targetObject;
        directionalLight.target.position.set(box_center.x, box_center.y, box_center.z);
        directionalLight.castShadow = true;
        const d = Math.max(scene_box.max.x, scene_box.max.y);
        directionalLight.shadow.camera.left = - d;
        directionalLight.shadow.camera.right = d;
        directionalLight.shadow.camera.top = d;
        directionalLight.shadow.camera.bottom = - d;
        this.scene.add(directionalLight);
        // Add ambient light so there aren't any black faces
        const ambient_light = new THREE.AmbientLight(0x404040, 3);
        this.scene.add(ambient_light);
        // Add plane to receive shadows
        /*
        let plan_size = Math.max(scene_box.max.x - scene_box.min.x, scene_box.max.y - scene_box.min.y) * 4;
        var planeGeometry = new THREE.PlaneGeometry(plan_size, plan_size);
        var planeMaterial = new THREE.MeshStandardMaterial({
            color: '#F0F0F0', side: THREE.FrontSide
        })
        var plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.receiveShadow = true;
        plane.position.set(box_center.x, box_center.y, scene_box.min.z);
        this.scene.add(plane);
        */
        // fit camera to object object -> https://stackoverflow.com/questions/14614252/how-to-fit-camera-to-object
    }

    /// this function process the data from power into ChartDataPoints that will be mapped to the scene objects in a later step
    /// IDs are alwas ncessary, values and categories are optional
    /// if categories are provided, display objects with the colors of the color palette
    /// if values are provided (even if categories are provided), display objects with a color gradient
    /// if neither categories nor values are provided, display objects in gray
    private visualTransform(options: VisualUpdateOptions, host: IVisualHost) {
        
        // check if there is data in dataViews
        let dataViews = options.dataViews;

        if (!dataViews
            || !dataViews[0]
            || !dataViews[0].categorical
            || !dataViews[0].categorical.categories
            || !dataViews[0].categorical.categories[0].source)
            //|| !dataViews[0].categorical.values)
            return;

        let categorical = dataViews[0].categorical;
        
        /*
        //code for original rhino loader
        let guid;
        let category;

        if (categorical.categories.length > 1) {
            if (categorical.categories[0].values.length == 0 || categorical.categories[1].values.length == 0) {
                console.log('Some category has no values.')
                return;
            }
            if (isUUID(categorical.categories[0].values[0])) {
                guid = categorical.categories[0];
                category = categorical.categories[1];
            } else if (isUUID(categorical.categories[1].values[0])) {
                guid = categorical.categories[1];
                category = categorical.categories[0];
            } else {
                console.log('No valid GUIDs imported.');
                return;
            }
            //console.log(guid);
            //console.log(category);
        } else {
            guid = categorical.categories[0];
        }

        let dataValue = undefined;
        let all_values;
        let min_value: number = 0;
        let max_value: number = 0;
        var values_by_category: { [category: string]: number; } = {};
        if (dataViews[0].categorical.values) {
            dataValue = categorical.values[0];
            all_values = dataValue.values.map(item => <number>item)

            // Define values array if categories are provided
            if (categorical.categories.length > 1) {
                for (let i = 0, len = Math.max(guid.values.length); i < len; i++) {
                    if (values_by_category[category.values[i]] != undefined) {
                        values_by_category[category.values[i]] += all_values[i];
                    } else {
                        values_by_category[category.values[i]] = all_values[i];
                    }
                }
                min_value = Math.max(values_by_category[category.values[0]], 0); // to avoid negative values
                for (const key in values_by_category) {
                    min_value = Math.min(values_by_category[key], min_value);
                    max_value = Math.max(values_by_category[key], max_value);
                }
            } else {
                min_value = Math.min(...all_values);
                max_value = Math.max(...all_values);
            }
        }

        let chartDataPoints: ChartDataPoint[] = [];
        let colorPalette = host.colorPalette;

        // Create datapoints
        for (let i = 0, len = Math.max(guid.values.length); i < len; i++) {
            if (dataValue != undefined) {
                let cat = category != undefined ? <string>category.values[i] : undefined;
                // Insert here value by category if categories are provided
                let value = 0.0;
                if (categorical.categories.length > 1) {
                    value = values_by_category[category.values[i]];
                } else {
                    value = all_values[i];
                }
                let color = this.getColumnColorByValue(value, min_value, max_value);
                chartDataPoints.push({ id: <string>guid.values[i], category: cat, value: value, color: color });
            } else if (categorical.categories.length > 1) {
                let cat = <string>category.values[i];
                let color = new Color(colorPalette.getColor(category.values[i].toString()).value);
                chartDataPoints.push({ id: <string>guid.values[i], category: cat, value: undefined, color: color });
            } else {
                chartDataPoints.push({ id: <string>guid.values[i], category: undefined, value: undefined, color: CustomVisual.Config.default_color });
            }
        }
        */
        

        //end of original rhino code

        // Update scene
        //prepare model properties 
        //console.log(CustomVisual.Instance.scene);
        var scene_mesh_all = CustomVisual.Instance.scene.children.filter(x => x.type == "Mesh");
        var scene_mesh = scene_mesh_all[0];//CustomVisual.Instance.scene.children.find(x => x.type == "Mesh");
        //var scene_mesh_obj3d = CustomVisual.Instance.scene.children.find(x => x.type == "Object3D");

        var IDs_to_show = [...new Set(categorical.categories.find(x => x.source.roles.id).values)];
        //console.log(IDs_to_show);

        //option 1 use hide and show
        //this interacts with all subsets
        
        scene_mesh['ifcManager'].hideAllItems(0);
        //scene_mesh['ifcManager'].showItems(0,guid.values);
        scene_mesh['ifcManager'].showItems(0,IDs_to_show);
        
        //var bbox = new THREE.Box3();
        //bbox.setFromObject(scene_mesh_obj3d);
        //CustomVisual.Instance.setCamera(scene_mesh['geometry'].boundingBox);
  

        //option 2 uses subsets // cannot make it work...
/*
        //var selectMaterial=new THREE.MeshPhongMaterial({ color: 0x999999 });
        if(scene_mesh_all[1] != undefined) scene_mesh_all[1].visible = false;
        //scene_mesh['ifcManager'].removeSubset(0,scene_mesh_all[1]);
        scene_mesh['ifcManager'].createSubset({
            modelID: 0,
            ids: IDs_to_show,
            material: CustomVisual.Config.solidMaterial,
            scene: CustomVisual.Instance.scene,
            removePrevious: true
        });
        //scene_mesh_all = CustomVisual.Instance.scene.children.filter(x => x.type == "Mesh")
        if(scene_mesh_all[1] != undefined) scene_mesh_all[1].visible = true;
        //CustomVisual.Instance.scene.remove()
         */

        //const HighlightMaterial = new THREE.MeshPhongMaterial({ color: 0x440044, depthTest: false, transparent: true, opacity: 0.3 });
        //console.log(scene_mesh);

        
        for(let i=1; i< scene_mesh_all.length; i++){ //start from 1, the 0th should be the IFCmodel mesh,  others should be subsets 
            if(scene_mesh_all[i].type == "Mesh"){
                scene_mesh_all[i].visible = false;
            }
        }
        
        //focus
        //selected_mesh.visible = false;
        CustomVisual.Instance.renderer.render(CustomVisual.Instance.scene, CustomVisual.Instance.camera);

        //Rhino
        /*
        var scene_objects = this.scene.children.find(x => x.type == "Object3D");
        for (let i = 0, len = scene_objects.children.length; i < len; i++) {
            var object = scene_objects.children[i] as THREE.Mesh;
            object.castShadow = true;
            object.receiveShadow = true;
            var dataPoint = chartDataPoints.find(x => x.id == object.userData["attributes"]["id"])
            if (dataPoint == undefined) {
                object.material = new THREE.MeshLambertMaterial({ color: CustomVisual.Config.default_color, side: THREE.DoubleSide, transparent: true, opacity: CustomVisual.Config.opacity_of_unselected_objects });
            } else {
                object.material = new THREE.MeshLambertMaterial({ color: dataPoint.color, side: THREE.DoubleSide });
            }
        }
        */

    }

    private getColumnColorByValue(
        value: number,
        min_value: number,
        max_value: number
    ): THREE.Color {
        let factor = 1.0;
        if (max_value != min_value) {
            factor = (Math.round(value * 100) / 100 - min_value) / (max_value - min_value);
        }
        let color = new THREE.Color();
        if (factor <= 0.5) {
            color = (new THREE.Color()).lerpColors(CustomVisual.Config.color1, CustomVisual.Config.color2, 2 * factor);
        } else {
            color = (new THREE.Color()).lerpColors(CustomVisual.Config.color2, CustomVisual.Config.color3, 2 * (factor - 0.5));
        }
        return color;
    }
}
