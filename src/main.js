/*
 * Copyright © 2020. TIBCO Software Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

//@ts-check - Get type warnings from the TypeScript language server. Remove if not wanted.

//these two imports are for dev and hard coded stuff
import {plotlySplom} from "./splom.plotly";
import {plotlyParser} from "./plotlyParser"; 
import {plotlyGUI} from "./plotlyGUI";   

 

/**
 * Get access to the Spotfire Mod API by providing a callback to the initialize method.
 * @param {Spotfire.Mod} mod - mod api!
 */
Spotfire.initialize(async (mod) => {

// console.clear();

    const reader = mod.createReader(
        mod.visualization.data(), 
        mod.property("useCustomRowIdentifierExpression"),
        mod.property("plotlySettings"),
        mod.windowSize()
    );
    const context = mod.getRenderContext();
    const modDiv = document.getElementById("mod-container");

    /**
     * Initiate the read loop
     */
    reader.subscribe(render);

    /**
     * @param {Spotfire.DataView} dataView
     * @param {Spotfire.ModProperty<boolean>} useCustomRowIdentifierExpression
     * @param {Spotfire.ModProperty<string>} plotlySettings
     * @param {Spotfire.Size} windowSize
     */
    async function render(dataView, useCustomRowIdentifierExpression,plotlySettings, windowSize) {

        // console.clear();

       //1. get default or saved preferences
       //default popout / plottly preferences for new visual instance
       //note! when adding new properties, make sure 1.b runs during development at least once to reset mod.property.plotlySettings
       let defaultPreferences = {
        isUpperHalfVisible: !true,
        isDiagonalVisible: true,
        showAxisLines: true, 
        showGridlines:false,
        gridLinesColor: context.styling.general.backgroundColor,
        plot_bgcolor: context.styling.general.backgroundColor,
        marker: {
            size: 8,
            color: "#000000",
            width: 0.5
        },
        labels:{
            fontSize:context.styling.scales.font.fontSize,
            xLabelRotation:0,
            yLabelRotation:0,
            showLabels:true,
            orientation:"Horizontal"
        },
        tooltips:{
            x:true,
            y:true,
            color:true,
            id:true,
            valueNames:"Value names and values"
        } 
       }   


       //1.a read plot settings from mod property
       let plotlySettingsValue = (await mod.property("plotlySettings")).value();
       
       //1.b if mod property not set, set defaults (set ovveride to true just once to reset mod property to default)
       let override = false;
       if (override||plotlySettingsValue=="-") (await mod.property("plotlySettings")).set(JSON.stringify(defaultPreferences)); 

       //1.c read mod property
       plotlySettingsValue = (await mod.property("plotlySettings")).value();
       let preferences = JSON.parse(plotlySettingsValue.toString()) || defaultPreferences;


       //1.d reset aggregation warning message 
       if(override) useCustomRowIdentifierExpression.set(false)


        //2. Add style according to canvas stylyng theme (dark or light) for errors and everything else
        plotlyGUI.setStyle(context);

        //3. Check for plot requirements (check for errors) 
        //3.1 Error handling starts here
        let errors = await dataView.getErrors(); 

        //3.2 check if ID is empty
        let measureAxis = await mod.visualization.axis("Measures"); 
        if (measureAxis.parts.length==0 || measureAxis.parts[0].expression !== "baserowid()" && !useCustomRowIdentifierExpression.value()) {
            plotlyGUI.createWarning(modDiv, context.styling.general.font.color, measureAxis, useCustomRowIdentifierExpression);
            mod.controls.errorOverlay.hide();
            return;
        } else { 
            plotlyGUI.clearWarning(modDiv);
        }

        //3.3 check if measures is empty (requires at least two measures)
        if (measureAxis.parts.length<2) {
            mod.controls.errorOverlay.show("Please select at least two columns for the Measures axis");
            return;
        };


        // 3.4 check if diagonals are off, then you need more columns 
        if (!preferences.isDiagonalVisible && measureAxis.parts.length<4 )  {
            mod.controls.errorOverlay.show("If Diagonal plots are turned off, you need at least 3 columns for the Measures axis in addition to the (Row Number) column");
            return;
        }

        //2.4 check additional errors
        if (errors.length > 0) {
            mod.controls.errorOverlay.show(errors);
            return;
        }

        //2.5 no errors, then continue
        mod.controls.errorOverlay.hide(); 
        //3. Get data from spotfire /* FIXXXXXXXXXXXXXXXXXX plotlyParser xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx*/
        //plotlyParser parses the hierarchy from X axis containing continous nested measures. 
        //[measure1] NEST [measure2] NEST [measure3] ... NEST [measureN]>

        //let start = new Date(); //for data parsing benchmark
        const parsedData = await plotlyParser.data(dataView).then((theParsedData)=>{
            //console.log("Parsing data took ", ((new Date()) - start)/1000," seconds");
            return theParsedData;
        });
        
        //or use demo data from irisCSVData
        //parsedData.rows = d3.csvParse(irisCSVData); 


        //get layout options
        let layout = await plotlyParser.layout(dataView, parsedData.rows, preferences, context, windowSize);


        //merge default preferences with plotly options
        let options = {
         colorScale:parsedData.colorScale,
         colors:parsedData.colors,
         fontColor:context.styling.scales.font.color,
         fontFamily:context.styling.scales.font.fontFamily,
         fontSize:context.styling.scales.font.fontSize,
         paper_bgcolor:context.styling.general.backgroundColor,
         plot_bgcolor:context.styling.general.backgroundColor,
         dimensions:layout.dimentions,
         axes:layout.axes,
         ...preferences
     }




       //render the plot
        //start = new Date(); //for benchmarking
        plotlySplom(parsedData.rows, options, windowSize, context); 
        //end parsing data and measuring performance
        //console.log("rendering took ", ((new Date()) - start)/1000," seconds");


        //tooltips and gui settings dialog 
        let colorAxisParts = (await mod.visualization.axis("Color")).parts;
        let measureAxisParts = (await mod.visualization.axis("Measures")).parts;


        const xHierarchy = await dataView.hierarchy("Measures");
        const columns =  xHierarchy.levels.map(x=>{return x.name} );

        plotlyGUI.setTooltips(mod,colorAxisParts,measureAxisParts, preferences,columns,context); //markers tooltips
        let font = {size:context.styling.general.font.fontSize,family:context.styling.general.font.fontFamily}
        plotlyGUI.setConfiguration(mod,preferences,context.isEditing,font,plotlySettings);
        
        
        //enable spotfire marking (also check splom.plotly.js layout.dragmode.select for plotly marking mode)
        let rows =  (await dataView.allRows());
        dataView.categoricalAxis("Measures")
        plotlyGUI.setMarking(rows,dataView);


        /**
         * Signal that the mod is ready for export.
         */
            mod.controls.errorOverlay.hide(); 
            context.signalRenderComplete(); 
    }
});
