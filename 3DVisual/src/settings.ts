/*
 *  Power BI Visualizations
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

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.Card;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/**
 * Data Point Formatting Card
 */
class DataPointCardSettings extends FormattingSettingsCard {
    defaultColor = new formattingSettings.ColorPicker({
        name: "defaultColor",
        displayName: "Highlight color",
        value: { value: "#FF00FF" }
    });

    showAllDataPoints = new formattingSettings.ToggleSwitch({
        name: "showAllDataPoints",
        displayName: "Show all",
        value: true
    });

    fill = new formattingSettings.ColorPicker({
        name: "fill",
        displayName: "Background color",
        value: { value: ""},
        isNoFillItemSupported: true
    });

    fillRule = new formattingSettings.GradientBar({
        name: "fillRule",
        displayName: "Color saturation",
        value: {minValue: "", midValue: "", maxValue: ""}
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Text Size",
        value: 12
    });

    maxColor = new formattingSettings.ColorPicker({
        name: "maxColor",
        displayName: "maxColor",
        value: { value: "#FF0000" },
        isNoFillItemSupported: true
    });
    midColor = new formattingSettings.ColorPicker({
        name: "midColor",
        displayName: "midColor",
        value: { value: "#0000FF" },
        isNoFillItemSupported: true
    });
    minColor = new formattingSettings.ColorPicker({
        name: "minColor",
        displayName: "minColor",
        value: { value: "#00FF00" },
        isNoFillItemSupported: true
    });
    conditionalColor = new formattingSettings.ColorPicker({
        
        instanceKind: powerbi.VisualEnumerationInstanceKinds.Rule, // <=== Support conditional formatting
        name: "conditionalColor",
        displayName: "conditionalColor",
        value: { value: "#999999" },
        isNoFillItemSupported: true
    });

    name: string = "dataPoint";
    displayName: string = "Color Settings 🎨";
    slices: Array<FormattingSettingsSlice> = [ //sequence of appearing in format pane
        this.defaultColor, 
        //this.showAllDataPoints, 
        this.fill, 

        this.maxColor,
        this.midColor,
        this.minColor,
        //this.fillRule, 
        //this.fontSize, 
        //this.conditionalColor,

    ];
    
}

class ifcFileCardSettings extends FormattingSettingsCard {
 
    showUploadIcon = new formattingSettings.ToggleSwitch({
        name: "showUploadIcon",
        displayName: "Show Upload Button",
        value: true
    });

    fileName = new formattingSettings.ReadOnlyText({
        name: "fileName",
        displayName: "File Name",
        value: ""
    });

    blob = new formattingSettings.ReadOnlyText({
        name: "blob",
        displayName: "File blob url",
        //value: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAApgAAAKYB3X3/OAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANCSURBVEiJtZZPbBtFFMZ/M7ubXdtdb1xSFyeilBapySVU8h8OoFaooFSqiihIVIpQBKci6KEg9Q6H9kovIHoCIVQJJCKE1ENFjnAgcaSGC6rEnxBwA04Tx43t2FnvDAfjkNibxgHxnWb2e/u992bee7tCa00YFsffekFY+nUzFtjW0LrvjRXrCDIAaPLlW0nHL0SsZtVoaF98mLrx3pdhOqLtYPHChahZcYYO7KvPFxvRl5XPp1sN3adWiD1ZAqD6XYK1b/dvE5IWryTt2udLFedwc1+9kLp+vbbpoDh+6TklxBeAi9TL0taeWpdmZzQDry0AcO+jQ12RyohqqoYoo8RDwJrU+qXkjWtfi8Xxt58BdQuwQs9qC/afLwCw8tnQbqYAPsgxE1S6F3EAIXux2oQFKm0ihMsOF71dHYx+f3NND68ghCu1YIoePPQN1pGRABkJ6Bus96CutRZMydTl+TvuiRW1m3n0eDl0vRPcEysqdXn+jsQPsrHMquGeXEaY4Yk4wxWcY5V/9scqOMOVUFthatyTy8QyqwZ+kDURKoMWxNKr2EeqVKcTNOajqKoBgOE28U4tdQl5p5bwCw7BWquaZSzAPlwjlithJtp3pTImSqQRrb2Z8PHGigD4RZuNX6JYj6wj7O4TFLbCO/Mn/m8R+h6rYSUb3ekokRY6f/YukArN979jcW+V/S8g0eT/N3VN3kTqWbQ428m9/8k0P/1aIhF36PccEl6EhOcAUCrXKZXXWS3XKd2vc/TRBG9O5ELC17MmWubD2nKhUKZa26Ba2+D3P+4/MNCFwg59oWVeYhkzgN/JDR8deKBoD7Y+ljEjGZ0sosXVTvbc6RHirr2reNy1OXd6pJsQ+gqjk8VWFYmHrwBzW/n+uMPFiRwHB2I7ih8ciHFxIkd/3Omk5tCDV1t+2nNu5sxxpDFNx+huNhVT3/zMDz8usXC3ddaHBj1GHj/As08fwTS7Kt1HBTmyN29vdwAw+/wbwLVOJ3uAD1wi/dUH7Qei66PfyuRj4Ik9is+hglfbkbfR3cnZm7chlUWLdwmprtCohX4HUtlOcQjLYCu+fzGJH2QRKvP3UNz8bWk1qMxjGTOMThZ3kvgLI5AzFfo379UAAAAASUVORK5CYII=",
        value: ""
    });

    jsonUpload = new formattingSettings.ShapeMapSelector({
        name: "jsonUpload",
        displayName: "upload a json file",
        isAzMapReferenceSelector: true,
        value: {
            type: "a",
            name: "a",
            content: "a"
        }
    });


    name: string = "ifcFileDetails";
    displayName: string = "IFC File details 📄";
    slices: Array<FormattingSettingsSlice> = [ //sequence of appearing in format pane
        this.showUploadIcon, 
        this.fileName, 
        this.blob,
        //this.jsonUpload
    ];
    
}

class CameraCardSettings extends FormattingSettingsCard {
    
    camera_save = new formattingSettings.ToggleSwitch({
        name: "camera_save",
        displayName: "Camera save",
        value: false
    });
    camera_load = new formattingSettings.ToggleSwitch({
        name: "camera_load",
        displayName: "Camera load",
        value: false
    });

/*
    camera_x = new formattingSettings.ReadOnlyText({
        name: "camera_x",
        displayName: "camera x",
        value: "29.743012224892425"
    });

    camera_y = new formattingSettings.ReadOnlyText({
        name: "camera_y",
        displayName: "camera y",
        value: "118.15578458228104"
    });

    camera_z = new formattingSettings.ReadOnlyText({
        name: "camera_z",
        displayName: "camera z",
        value: "16.393518828647093"
    });

    camera_rx = new formattingSettings.ReadOnlyText({
        name: "camera_rx",
        displayName: "camera rotation x",
        value: "-1.570795336908673"
    });

    camera_ry = new formattingSettings.ReadOnlyText({
        name: "camera_ry",
        displayName: "camera rotation y",
        value: "0.0000000000000001"
    });

    camera_rz = new formattingSettings.ReadOnlyText({
        name: "camera_rz",
        displayName: "camera rotation z",
        value: "0.14265354989823922"
    });

    control_x = new formattingSettings.ReadOnlyText({
        name: "control_x",
        displayName: "control x",
        value: "29.74299445684203"
    });

    control_y = new formattingSettings.ReadOnlyText({
        name: "control_y",
        displayName: "control y",
        value: "-6.8159723205730725"
    });

    control_z = new formattingSettings.ReadOnlyText({
        name: "control_z",
        displayName: "control z",
        value: "16.393395120826593"
    });
*/
    name: string = "cameraSettings";
    displayName: string = "Camera State 📷";
    slices: Array<FormattingSettingsSlice> = [ //sequence of appearing in format pane
        this.camera_save,
        this.camera_load
/*        
        this.camera_x,
        this.camera_y,
        this.camera_z,
        this.camera_rx,
        this.camera_ry,
        this.camera_rz,
        this.control_x,
        this.control_y,
        this.control_z
*/
    ];
    
}
/**
* visual settings model class
*
*/
export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    // Create formatting settings model formatting cards
    dataPointCard = new DataPointCardSettings();
    cameraCard = new CameraCardSettings();
    ifcFileCard = new ifcFileCardSettings();
    cards = [
        this.dataPointCard, 
        this.cameraCard,
        this.ifcFileCard
    ];

}
