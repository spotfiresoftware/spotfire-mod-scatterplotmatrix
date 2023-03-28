let unpack = (rows, key) => { return rows.map(function(row) { return row[key]; });}
let axis = (preferences,context,xy) => ({
        showline:preferences.showAxisLines,
        zeroline:false,
        gridcolor:preferences.showGridlines?context.styling.general.font.color+"55":context.styling.general.backgroundColor,
        linecolor:context.styling.general.font.color+"55",
        automargin:"height+width",
        fixedrange:true,
        tickangle:preferences.labels.orientation=="Horizontal"?xy=="X"?(-0):(0):xy=="X"?(0):(-90),
        ticklen:4,
                // rangeslider:true,
                // rangeslider:{
                //         thickness:.005,
                //         bgcolor:context.styling.general.font.color+"55"
                // },
                // rangeselector:{
                //         visible:true,
                //         buttons:[{label:"caca"}],
                //         bgcolor:"#FF0000"
                // },
        visible:preferences.labels.showLabels,
        tickcolor:context.styling.general.font.color+"55",
        // title:{standoff:50}, //◄ increase when rotating orthogonal titles. Check plotlyGUI.js label rotation css rules
        automargin:"true",
        tickfont:{
                size:context.styling.scales.font.fontSize, 
                family:context.styling.scales.font.fontFamily, 
                color:context.styling.scales.font.color
        },
        // rangeslider:{autorange:true, thickness:.025}
})


export const plotlyParser = {
        //returns [[1.2,"#F0A62D"],[2.5,"#FF5FA0"]] if color is coninuous or [["A","#F0A62D"],["B","#FF5FA0"]]
        getColorScale:async (dataView)=>{

                //get Color axis
                let colorAxis = (await dataView.axes()).filter(ax=>{return ax.name=="Color"})[0];

                // get row values
                let arr= (await dataView.allRows()).map((row)=>[
                        colorAxis.isCategorical?
                                row.categorical("Color").formattedValue():
                                row.continuous("Color").value(),
                        row.color().hexCode
                ]) 
                return [[0,arr[0][1]], ...arr, [1,arr[arr.length-1][1]]]
        },

        //returns something like this: [{"col1":row1, col2:row1,..,colN:row1},..,{"col1":rowN, col2:rowN,..,colN:rowN}]
        //dataView must contain a hierarchy of continious values on the  X axis. First level must be rowid to ensure data integrity
        data:async function(dataView){

                let outputData=[];
                let colors=[]
                let colorDict = {};

                const xHierarchy = await dataView.hierarchy("Measures");
                const cols =  xHierarchy.levels.map(x=>{return x.name} )
                cols.shift(); //removes the rowid
                cols.push("class");//adds color
                const root = await xHierarchy.root();
                const rowCount = await dataView.rowCount();
                var i=0;
                const dataViewAxes = await dataView.axes()
                next(root, "");
        
                //traverse the hierarchy
                function next(node) {
                        if(node.children) {
                                node.children.forEach(node => next(node)); 
                        } else {
                                let aRow={}
                                node.rows().forEach( (row,k) => {

                                        //add index
                                        aRow["index"] = i

                                        //colors and colorScaleDict
                                        let hex = row.color().hexCode
                                        let val = i++/rowCount;
                                        colorDict[hex]=0;
                                        colors.push(hex);

                                        //data
                                        let r = row.categorical("Measures").value().map(v=>{return v.value()});
                                        if(dataViewAxes.find(anAxis=>anAxis.name=="Color")) r.push(row.categorical("Color").formattedValue()); //add color
                                        r.shift() //remove the rowid from the parsed data
                                        r.forEach((v,i)=>{
                                                aRow[cols[i]]=isNaN(v)?String(v):v;
                                        })
                                        return outputData.push(aRow)
                                })
                        }
                }


                colorDict=Object.keys(colorDict);
                let colorScale=[];
                colorDict.forEach((x,i)=>{colorScale.push([(1/colorDict.length)*i,x]);colorScale.push([(1/colorDict.length)*(i+1),x])});

                if(colorDict.length==1) colorDict = [...colorDict,...colorDict];
                
                colors = colors.map((x,i)=>{return colorDict.indexOf(x)/(colorDict.length-1)});

                return ({rows:outputData,colors:colors,colorScale:colorScale})
        },

        layout:async function(dataView,rows,preferences,context, windowSize){

                //dimensions
                const xHierarchy = await dataView.hierarchy("Measures");
                const columns =  xHierarchy.levels.map(x=>{return x.name} );

                const dimentions =  columns.map(dimention=>{

                        //do math between visualization width, font pixel size to determine max text width (TODO)
                        let fontScaleFactor = .8; //fontSize is the height, not with of the text. Width is often smaller.
                        let aLabel = dimention;
                        let maxWidth = windowSize.width / (columns.length-1); //this is the approx width per chart
                        let maxWChars = maxWidth / context.styling.scales.font.fontSize * fontScaleFactor;
                        let maxHeight = windowSize.height / (columns.length-1); //this is the approx height per chart
                        let maxHChars = maxHeight / context.styling.scales.font.fontSize * fontScaleFactor;

                        //trim if label too long
                        if(aLabel.length > maxWChars) aLabel=dimention.slice(0,maxWChars) + "...";
                        if(aLabel.length > maxHChars) aLabel=dimention.slice(0,maxHChars) + "...";

                        return {label:aLabel, values:unpack(rows,dimention)}
                })
                dimentions.shift();//remove first column, which is the (row number)

                //axes
                let axes = {} 
        
                dimentions.forEach((e,i)=>{
                        axes["xaxis"+(i==0?"":i+1)] = axis(preferences,context,"X");
                        axes["yaxis"+(i==0?"":i+1)] = axis(preferences,context,"Y")
                })

                return {dimentions:dimentions, axes:axes}
        } 

}


