// Global variables that don't need to be reset everytime runScoreboard
// is called
var fpRegFile = Array(32).fill(0.0);
var intRegFile = Array(32).fill(0);
var dataMem = [45, 12, 0, 0, 10, 135, 254, 127, 18, 4,
               55, 8, 2, 98, 13, 5, 233, 158, 167];
var hardware = {
    fpAdder:{ busy:0, inst:null, inputA:null, inputB:null, result:null},
    fpMult:{ busy:0, inst:null, inputA:null, inputB:null, result:null},
    fpDiv:{ busy:0, inst:null, inputA:null, inputB:null, result:null},
    integer:{ busy:0, inst:null, inputA:null, inputB:null, result:null}
};
// This needs to be global so executeInstruction() can update it on a branch
var IC = 0;

/**
* function runScoreboard()
* This function reads the parameters to get the clock cycles required
* for each Functional Unit, then parses the code in order to use it to build
* the scoreboard and display it in a table.
*/
function runScoreboard(){
	// Setup
	IC = 0;
	var clk = 0;
    var hardwareLatency = {fpAdder:0, fpMult:0, fpDiv:0, integer:0};
    var pipeline = [];
	var instList = document.getElementById('instruction_input').value;
    var scoreboard = [];
	getHardwareLatencies(hardwareLatency);
    
	// Split each line into its own instruction and remove any empty lines
	instList = instList.split('\n');
	instList = instList.filter(function(inst){
		return (inst.trim() !== '');
	});
	instList = instList.map(function(line){
	   return getInstructionType(line);
	});
	while ((IC < instList.length) || (pipeline.length > 0)){
	    for (var inst in pipeline){
	        // If waiting to issue, check WAW and FU
	        if (pipeline[inst].state == "waiting"){
	            var canIssue = true;
	            for (var otherInst in pipeline){
	                if (otherInst >= inst) break;
	                if (pipeline[inst].dest === pipeline[otherInst].dest){
	                    console.log("Cannot Issue " + pipeline[inst].inst + " on clk: "+ clk + "; waiting for " + pipeline[otherInst].inst + " to finish.");
	                    canIssue = false;
	                    break;
	                }
	                if (pipeline[inst].FU === pipeline[otherInst].FU){
	                    canIssue = false;
	                    console.log("Cannot Issue " + pipeline[inst].inst + " on clk: "+ clk + "; waiting for " + pipeline[otherInst].inst + " for FU.");
	                    break;
	                }
	            }
	            if (canIssue){
	                pipeline[inst].nextState = "issue";
	                console.log("Issuing " + pipeline[inst].inst + " on clk: " + clk);
	            }
	        }
	        
	        // If the instruction has all sources, it can read the variables
	        // Check for RAW
	        else if (pipeline[inst].state == "issue"){
	            var canRead = true;
	            for (var otherInst in pipeline){
	                if (otherInst >= inst) break;
	                if (    pipeline[otherInst].dest === pipeline[inst].src
	                    ||  pipeline[otherInst].dest === pipeline[inst].trgt){
	                    canRead = false;
	                    break;
	                }
	            }
	            if (canRead){
	                pipeline[inst].nextState = "read";
	                hardware[pipeline[inst].FU].busy = hardwareLatency[pipeline[inst].FU];
	                hardware[pipeline[inst].FU].inputA = getValue(pipeline[inst].src);
	                hardware[pipeline[inst].FU].inputB = getValue(pipeline[inst].trgt);
	                hardware[pipeline[inst].FU].inst = pipeline[inst].inst;
	            }
	        }
	        // The instruction will stay in read until it's HW timer
	        // reaches 0
	        else if (pipeline[inst].state == "read"){
	            if (hardware[pipeline[inst].FU].busy > 1){
	                hardware[pipeline[inst].FU].busy--;
	            }
	            else {
	                // Since no other instruction can execute as long as there is an
	                // instruction in the pipeline using the same FU, nothing will
	                // "execute" until the WB state
	                pipeline[inst].nextState = "exec";
	                hardware[pipeline[inst].FU].busy = 0;
	            }
	        }
	        // Before writing the output, check for WAR (Ensure no instruction
	        // that is waiting to read has this instruction dest as an input)
	        else if (pipeline[inst].state == "exec"){
	            var canWrite = true;
	            for (var otherInst in pipeline){
	                if (otherInst >= inst) break;
	                if (    pipeline[inst].dest === pipeline[otherInst].src
	                    ||  pipeline[inst].dest === pipeline[otherInst].trgt
	                    ||  pipeline[otherInst].type === "ctrl"){
    	                canWrite = false;
    	                break;
	                }
	            }
	            if (canWrite){
	                pipeline[inst].nextState = "wb";
	                var fu = hardware[pipeline[inst].FU];
	                executeInstruction(fu.inst, fu.inputA, fu.inputB, pipeline[inst].dest);
	                
	            }
	        }
	    }
	    
        // Add next element into the pipeline
        if ((instList[IC]) && ((pipeline.length == 0) || (pipeline[pipeline.length-1].nextState === "issue"))){
            pipeline.push(instList[IC]);
            // console.log("Adding" + instList[IC].inst + "to the pipeline on clk: " +clk);
            IC++;
        }
        
	    // Update all states of instructions in the pipeline and move completed
	    // from the pipeline to the scoreboard.
	    for (var inst in pipeline){
	        if (pipeline[inst].state !== pipeline[inst].nextState){
	            pipeline[inst].state = pipeline[inst].nextState;
	            pipeline[inst][pipeline[inst].state] = clk;
	        }
	    }
	    pipeline = pipeline.filter(function(inst){
	       if (inst.state === "wb"){
	           scoreboard.push(inst);
	           return false;
	       }
	       return true;
	    });

	    clk++;
	}
	// Since instructions were put in the scoreboard at different times (done at WB),
	// they need to be sorted by issue clk cycles
	scoreboard.sort(function(a, b){
	   return (a.issue - b.issue); // needed to be negative to sort in ascending order
	});
	printScoreboard(scoreboard);
	printRegisterFile(intRegFile, "regFile_table", "RegFile");
	printRegisterFile(fpRegFile, "fpRegFile_table", "FP RegFile");
//	console.log(scoreboard);
	return instList;
}

/**
* function getHardwareLatencies()
* This function reads the textareas in the HTML page to obtain the latenies
* for each type of hardware. Since this project only uses one of each type,
*
*/
function getHardwareLatencies(hardwareLatency){
	hardwareLatency.fpAdder = parseInt(document.getElementById("fpAdder_clks").value);
	hardwareLatency.fpMult = parseInt(document.getElementById("fpMult_clks").value);
	hardwareLatency.fpDiv = parseInt(document.getElementById("fpDiv_clks").value);
	hardwareLatency.integer = parseInt(document.getElementById("integer_clks").value);
}

/**
* function getInstructionType(parsed)
* This function takes an instruction and breaks it down into components
* shared across all instruction types as well as ones specific to that
* instruction. Each instruction has a type, FU, src, and dest, but a few
* also have target registers.
*
*/
function getInstructionType(instruction){
	// Make each element uppercase and remove any whitespace on the ends
	instruction = instruction.toUpperCase();
	var parsed = instruction.trim().split(/[\s,]+/);
	var instructionObject;
	// Memory Instruction
	if (parsed[0] == "L.D"){
	    var regLoc = parsed[2].match(/(\$\d+)/);
		instructionObject = {type:"mem", dest:parsed[1], src:parsed[2], trgt:null, FU:"integer"};
	}
	else if (parsed[0] == "S.D"){
	    var regLoc = parsed[2].match(/(\$\d+)/);
		instructionObject = {type:"mem", dest:parsed[1], src:parsed[2], trgt:null, FU:"integer"};
	}
	// Control Instruction
	else if (	parsed[0] == "BEQ"
			 ||	parsed[0] == "BNE"){
		instructionObject = {type:"ctrl", src:parsed[1], trgt:parsed[2], dest:parsed[3], FU:"integer"};
	}
	// ALU Instruction
	else {
		if (parsed[0][parsed[0].length-1] == 'I'){
			instructionObject = {type:"alu_i", src:parsed[2], trgt:parsed[3], dest:parsed[1], FU:"integer"};
		}
		else if (parsed[0].substring(parsed[0].length-2) == ".D"){
			instructionObject = {type:"alu_f", src:parsed[2], trgt:parsed[3], dest:parsed[1], FU:"integer"};
			if (parsed[0].match(/SUB|ADD/)) instructionObject.FU = "fpAdder";
			else if (parsed[0].match(/MULT/)) instructionObject.FU = "fpMult";
			else if (parsed[0].match(/DIV/)) instructionObject.FU = "fpDiv";
			else instructionObject.FU = null;
		}
		else{
			instructionObject = {type:"alu_r", src:parsed[2], trgt:parsed[3], dest:parsed[1], FU:"integer"};
		}
	}
	instructionObject.inst = parsed[0];
	instructionObject.issue = 0;
	instructionObject.read = 0;
	instructionObject.exec = 0;
	instructionObject.wb = 0;
	instructionObject.state = "waiting";
	instructionObject.nextState = instructionObject.state;
	console.log(instructionObject);
    return instructionObject;
}
/**
 * function getValue(input)
 * This function returns the number stored in a register file
 * Parameters:
 *      input - string starting with F, $, or # representing the index in the
 *              FP Register File, Integer Register File, or an immediate
 * Return - value stored in that register index or the immediate value
 *
 */
function getValue(location){
    if (location === null){
        return null;
    }
    if (location[0] === 'F'){
        var idx = parseInt(location.substring(1));
        return (fpRegFile[idx] || 0);
    }
    if (location[0] === '$'){
        var idx = parseInt(location.substring(1));
        return (intRegFile[idx] || 0);
    }
    if (location[0] === '#'){
        return location.substring(1);
    }
    var parsedInput = location.match(/(\d*)\(\$(\d)\)/);
    if (parsedInput){
        index = intRegFile[parsedInput[2]];
        offset = parsedInput[1]
        return (dataMem[index+offset] || 0);
    }
}

function setValue(location, val){
    if (location[0] === 'F'){
        var idx = parseInt(location.substring(1));
        fpRegFile[idx] = val;
    }
    if (location[0] === '$'){
        var idx = parseInt(location.substring(1));
        // Ensure the value is an integer
        intRegFile[idx] = Math.floor(val);
    }
    var parsedInput = location.match(/(\d*)\(\$(\d)\)/);
    if (parsedInput){
        index = intRegFile[parsedInput[2]];
        offset = parsedInput[1]
        dataMem[index+offset] = val;
    }
    return val;
}

/**
 * function executeInstr(inst, inputA, inputB, destLoc)
 * This function executes the instruction and returns the result
 * parameters:
 *      inst - the instruction command to execute
 *      srcVal - the source register value, not the register index
 *               e.g 123, not $4 (Assume $4 = 123)
 *      trgtVal - the target register, if applicable. Same rules as srcVal
 *      destLoc - the destination location in the regfile/memory.
 *                This SHOULD be in the format $5, F6, 0($3), etc...
 *                OR the destination IC for branch instructions
 * Return:
 *      this function returns a the result from all calculations, loads
 *      and stores, and a boolean value if a branch instruction should
 *      execute.
 */
function executeInstruction(inst, srcVal, trgtVal, destLoc){
    if (inst === "L.D"){
        var fromMem = dataMem[srcVal];
        return setValue(destLoc, fromMem);
    }
    if (inst === "S.D"){
        return setValue(destLoc, trgtVal);
    }
    if (inst === "BEQ"){
        if (srcVal === trgtVal){
            IC = destLoc;
            return true;
        }
        return false;
    }
    if (inst === "BNE"){
        if (srcVal !== trgtVal){
            IC = destLoc;
            return true;
        }
        return false;
    }
    // Javascript will add integers and floats with the same
    // notation and the values will be in srcVal and trgtVal,
    // so use same if statement for any add
    if (inst.match(/ADD/)){
        var sum = srcVal+trgtVal;
        setValue(destLoc, sum);
        return sum;
    }
    if (inst.match(/SUB/)){
        var diff = srcVal-trgtVal;
        setValue(destLoc, diff);
        return diff;
    }
    if (inst === "MULT.D"){
        var prod = srcVal*trgtVal;
        setValue(destLoc, prod);
        return prod;
    }
    if (inst === "DIV.D"){
        var quot = srcVal/trgtVal;
        setValue(destLoc, quot);
        return quot;
    }
    
}

function printScoreboard(sb){
    var table = document.getElementById("scoreboard_table");
    while (table.childNodes.length > 0) {
        table.removeChild(table.childNodes[0]);
    }
    
    var headers = ["Inst", "Dest", "Src", "Trgt", "Issue",
                   "Read", "Exec", "WB"];
    var row = document.createElement("tr");
    for (var h in headers){
        var header = document.createElement("th");
        header.innerHTML=headers[h];
        row.appendChild(header);
    }
    table.appendChild(row);
    for (var inst = 0; inst < sb.length; inst++){
        row = document.createElement("tr");
        for (var element in headers){
            var col = document.createElement("td");
            if (sb[inst][headers[element].toLowerCase()] !== null)
                col.innerHTML=sb[inst][headers[element].toLowerCase()];
            else
                col.innerHTML='N/A';
            row.appendChild(col);
        }
        table.appendChild(row);
    }
}

function printRegisterFile(regFile, htmlTable, title){
    var rfTable = document.getElementById(htmlTable);
    // Remove any previous data
    while (rfTable.childNodes.length > 0) {
        rfTable.removeChild(rfTable.childNodes[0]);
    }
    if (title){
        var tableTitle = document.createElement("h3");
        tableTitle.innerHTML = title;
        rfTable.appendChild(tableTitle);
    }
    var row = document.createElement("tr");
    var data = document.createElement("th");
    data.innerHTML = "Index";
    row.appendChild(data);
    data = document.createElement("th");
    data.innerHTML = "Value";
    row.appendChild(data);
    rfTable.appendChild(row);
    for (var i = 0; i < regFile.length; i++){
        row = document.createElement("tr");
        
        data = document.createElement("td");
        data.innerHTML = i;
        row.appendChild(data);
        
        data = document.createElement("td");
        data.innerHTML = regFile[i];
        row.appendChild(data);
        rfTable.appendChild(row);
    }
    
}