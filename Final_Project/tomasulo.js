/***************************************************/
/********** Class Definitions **********************/
/***************************************************/
/**
 * Class: ReservationStation_t
 * Description: This class defines a reservation station for a particular
 *              functional unit. The unit is defined in the constructor.
 * Methods: This class implements methods to easily control what goes in
 *          and manage executing the instructions.
 **/
class ReservationStation_t {
    constructor(type, size, pipelined, latency){
        this.type = type;
        this.maxSize = size;
        this.pipelined = pipelined;
        this.latency = latency;
        this.rs = [];
    }
    addInstruction(inst){
        if (inst.FU != this.type){
            throw new Error("Wrong Reservation Station: This="+this.type+", Inst="+inst.FU);
        }
        if (this.rs.length == this.maxSize){
            return false;
        }
        else {
            this.rs.push({inst:inst.inst, src:inst.src, trgt:inst.trgt,
                          inputA:null, inputB:null, result: null,
                          cycle:this.latency-1, ready:false, written:false, id: inst.id});
            // for single cycle instructions, they will be ready on the next cycle
            if (this.rs[this.rs.length-1].cycle <= 0){
                this.rs[this.rs.length-1].ready = true;
            }
            return this.rs[this.rs.length-1];
        }
    }
    isFull(){
        return (this.rs.length == this.maxSize);
    }
    getElement(i){
        return this.rs[i];
    }
    cycleStation(){
        if (this.pipelined){
            this.rs.forEach(function(rsSlot){
                if (rsSlot.inputA !== null && rsSlot.inputB !== null){
                    if (rsSlot.cycle > 0)
                        rsSlot.cycle--;
                    if (rsSlot.cycle === 0)
                        rsSlot.ready = true;
                }
                    
            });
        }
        else {
            if (this.rs.length > 0){
                if (this.rs[0].inputA !== null && this.rs[0].inputB !== null){
                    if (this.rs[0].cycle > 0)
                        this.rs[0].cycle--;
                    if (this.rs[0].cycle === 0)
                        this.rs[0].ready = true;
                }
            }
        }
    }
    removeWritten(){
        this.rs = this.rs.filter(function(element){
            return !element.written;
        });
    }
    removeById(id){
        for (var inst = 0; inst < this.rs.length; inst++){
            if (id === this.rs[inst].id){
                return this.rs.splice(inst, 1);
            }
        }
        return null;
    }
}
/**
 *  The reorder buffer in this program is an expansion of the actual
 *  reoder buffers in real hardware. This one acts similar to a pipeline
 *  class, since it hold each instruction and all its data (unlike a real one
 *  that would only hold the instruction, destination, and value).
 **/
class ReorderBuffer {
    constructor(maxSize){
        this.maxSize = maxSize;
        this.buffer = [];
    }
    isFull(){
        return (this.buffer.length == this.maxSize);
    }
    addInstr(inst){
        if (!this.isFull()){
            var hwInUse = hardware.filter(function(unit){
                return (unit.type === inst.FU)
            })[0];
            inst.hwInUse = hwInUse.addInstruction(inst);
            this.buffer.push(inst);
        }
        return this.buffer[this.buffer.length-1];
    }
    getInst(n){
        return this.buffer[n];
    }
    getBuffLength(){
        return this.buffer.length;
    }
    getLastElement(){
        return this.getInst(this.getBuffLength()-1);
    }
    removeElement(i){
        return this.buffer.splice(i, 1);
    }
    removeNext(){
        if ((this.buffer[0])){
            if (this.buffer[0].ready){
                return this.buffer.splice(0,1)[0];
            }
        }
        return null;
    }
    toString(){
        return this.buffer;
    }
    
    executeInst(i){
        var thisInst = this.getInst(i);
        thisInst.result = executeInstruction(thisInst.inst,
                                            thisInst.hwInUse.inputA,
                                            thisInst.hwInUse.inputB,
                                            thisInst.dest);
        thisInst.nextState = "wb";
        thisInst.hwInUse.written = true;
    }
    commitNextInst(clk, scoreboard){
        var curInst = this.removeNext();
        if (curInst === null)
            return null;
        
        if (curInst.type !== "ctrl"){
            setValue(curInst.dest, curInst.result);
        }
        else if (curInst.result === true){
            IC = getValue(curInst.dest);
            var removedInsts = this.buffer;
            this.buffer = [];
            removedInsts.forEach(function(removed){
                hardware.forEach(function(unit){
                    if (unit.type === removed.FU){
                        scoreboard.push(deepCopy(removed));
                        unit.removeById(removed.id);
                    }
                });
            });
        
        }
        curInst.commit = clk;
        scoreboard.push(deepCopy(curInst));
        return curInst;
    }
    
}

/***************************************************/
/**************** Global Variables *****************/
/***************************************************/

// Global variables that are accessed by multiple functions
var fpRegFile = Array(32).fill(0.0);
var intRegFile = Array(32).fill(0);
var dataMem = [45, 12, 0, 0, 10, 135, 254, 127, 18, 4,
               55, 8, 2, 98, 13, 5, 233, 158, 167];
var IC = 0;
var hardware;
var tag = 0;
/***************************************************/
/**************** Funtion Declarations *************/
/***************************************************/


/**
 * Function: startScoreboard()
 * This function surrounds runScoreboard() in a try/catch block so it can
 * easily display any error messages to the user through an alert popup.
 */
function startScoreboard(){
    try {
       runScoreboard();
    }
    catch (e){
        alert("Error: " + e + "\n");
        console.error(e.stack);
    }
}

/**
* function getHardwareLatencies()
* This function reads the textareas in the HTML page to obtain the latenies
* for each type of hardware. Since this project only uses one of each type,
*
*/
function getHardware(hardware){
    hardware = [];
    hardware.push(new ReservationStation_t(
                        'fpAdder',
                        parseInt(document.getElementById('fpAdder_rs').value),
                        true,
                        parseInt(document.getElementById('fpAdder_clks').value)));
    hardware.push(new ReservationStation_t(
                        'fpMult',
                        parseInt(document.getElementById('fpMult_rs').value),
                        true,
                        parseInt(document.getElementById('fpMult_clks').value)));
    hardware.push(new ReservationStation_t(
                        'fpDiv',
                        parseInt(document.getElementById('fpDiv_rs').value),
                        true,
                        parseInt(document.getElementById('fpDiv_clks').value)));
    hardware.push(new ReservationStation_t(
                        'load',
                        parseInt(document.getElementById('load_rs').value),
                        true,
                        parseInt(document.getElementById('load_clks').value)));
    hardware.push(new ReservationStation_t(
                        'store',
                        parseInt(document.getElementById('store_rs').value),
                        true,
                        parseInt(document.getElementById('store_clks').value)));
    hardware.push(new ReservationStation_t(
                        'integer',
                        parseInt(document.getElementById('integer_rs').value),
                        false,
                        parseInt(document.getElementById('integer_clks').value)));
    return hardware;
}

/**
* Function: getInstructionType(instruction)
* This function takes an instruction and breaks it down into components.
* Parameters:
*       instruction - trimmed instruction line from assembly code
*/
function getInstructionType(instruction){
    // Make each element uppercase and remove any whitespace on the ends
    instruction = instruction.toUpperCase();
    var parsed = instruction.trim().split(/[\s,]+/);
    var instructionObject;
    // Memory Instruction
    if (parsed[0] == "L.D"){
        var regVal = parsed[2].match(/(\$\d+)/);
        instructionObject = {type:"mem", dest:parsed[1], src:parsed[2],
                             trgt:regVal[0], FU:"load"};
    }
    else if (parsed[0] == "S.D"){
        var regVal = parsed[2].match(/(\$\d+)/);
        instructionObject = {type:"mem", dest:parsed[2], src:parsed[1],
                             trgt:regVal[0], FU:"store"};
    }
    // Control Instruction
    else if ((parsed[0] == "BEQ") || (parsed[0] == "BNE")){
        instructionObject = {type:"ctrl", src:parsed[1], trgt:parsed[2],
                             dest:parsed[3], FU:"integer"};
    }
    // ALU Instruction
    else {
        if (parsed[0][parsed[0].length-1] == 'I'){
            instructionObject = {type:"alu_i", src:parsed[2], trgt:parsed[3],
                                 dest:parsed[1], FU:"integer"};
        }
        else if (parsed[0].substring(parsed[0].length-2) == ".D"){
            instructionObject = {type:"alu_f", src:parsed[2], trgt:parsed[3],
                                 dest:parsed[1], FU:"integer"};
            if (parsed[0].match(/SUB|ADD/)) instructionObject.FU = "fpAdder";
            else if (parsed[0].match(/MULT/)) instructionObject.FU = "fpMult";
            else if (parsed[0].match(/DIV/)) instructionObject.FU = "fpDiv";
            else {
                throw new Error ("Unknown Instruction: " + instruction);
            }
        }
        else{
            instructionObject = {type:"alu_r", src:parsed[2], trgt:parsed[3],
                                 dest:parsed[1], FU:"integer"};
        }
    }
    instructionObject.inst = parsed[0];
    instructionObject.issue = null;
    instructionObject.read = false;
    instructionObject.exec = null;
    instructionObject.wb = null;
    instructionObject.ready = false;
    instructionObject.commit = null;
    instructionObject.state = "waiting";
    instructionObject.id = tag;
    tag++;
    instructionObject.nextState = instructionObject.state;
    return instructionObject;
}

/**
 * Function: getValue(input)
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
        
        var v = (intRegFile[idx] || 0);
        return v;
    }
    if (location[0] === '#'){
        return parseInt(location.substring(1));
    }
    var parsedInput = location.match(/(\d*)\(\$(\d+)\)/);
    if (parsedInput){
        index = parseInt(intRegFile[parsedInput[2]]);
        offset = parseInt(parsedInput[1]);
        return (parseInt(dataMem[index+offset]) || 0);
    }
    
    throw new Error("Could not obtain a value from \"" + location +
           "\". Check that is is formatted correctly (see README)");
}

/**
 * Function: setValue(location, val)
 * This function sets location in the register files/data memory to val. Note
 * this function will make any floating point value an integer before putting it
 * int the integer register file.
 * Parameters:
 *      location - the location to store to (e.g. F0, $0, or 0($3) for a
 *                 floating point register, integer register, or data memory
 *                 location respecitively).
 *      val - The value to set that register to.
 */
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
    var parsedInput = location.match(/(\d*)\(\$(\d+)\)/);
    if (parsedInput){
        index = parseInt(intRegFile[parsedInput[2]]);
        offset = parseInt(parsedInput[1]);
        dataMem[index+offset] = val;
    }
    return val;
}

/**
 * Function: executeInstr(inst, inputA, inputB, destLoc)
 * This function executes the instruction and returns the result. This function
 * will also store the value in the destination location.
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
        return srcVal;
    }
    if (inst === "S.D"){
        return srcVal;
    }
    if (inst === "BEQ"){
        if (srcVal === trgtVal){
            return true;
        }
        return false;
    }
    if (inst === "BNE"){
        if (srcVal !== trgtVal){
            return true;
        }
        return false;
    }
    // Javascript will uses the same arithmetic operators for float and
    // integers, so just check the operator. setValue() will ensure it gets
    // saved as a float or int.
    if (inst.match(/ADD/)){
        var sum = srcVal+trgtVal;
        return sum;
    }
    if (inst.match(/SUB/)){
        var diff = srcVal-trgtVal;
        return diff;
    }
    if (inst.match(/MULT/)){
        var prod = srcVal*trgtVal;
        return prod;
    }
    if (inst.match(/DIV/)){
        var quot = srcVal/trgtVal;
        return quot;
    }
}

/**
 * Function: deepCopy(obj)
 * By default javascript passes anything more than a primitive type by
 * reference, so this function is used to create an identical copy by making a
 * new object with the same keys and values.
 * Parameters:
 *      obj - the obj to be copied
 * Returns: New object with identical key-value pairs as obj
 */
function deepCopy(obj){
    var newObj = {};
    Object.keys(obj).forEach(function(property){
        newObj[property] = obj[property];
    });
    return newObj;
}

/**
 * Function: printScoreboard(sb)
 * This function takes an array of instructions and prints the scoreboard to
 * the HTML table called scoreboard_table
 * Parameters:
 *      sb - the array of intstructions with clk cycles of each stage's
 *           completion
 */
function printScoreboard(sb){
    var table = document.getElementById("scoreboard_table");
    while (table.childNodes.length > 0) {
        table.removeChild(table.childNodes[0]);
    }
    
    var headers = ["Inst", "Dest", "Src", "Trgt", "Issue",
                   "Exec", "WB", "Commit"];
    var row = document.createElement("tr");
    for (var h in headers){
        var header = document.createElement("th");
        header.innerHTML=headers[h];
        row.appendChild(header);
    }
    table.appendChild(row);
    for (var inst = 0; inst < sb.length; inst++){
        row = document.createElement("tr");
        headers.forEach(function(header){
            var col = document.createElement("td");
            if (sb[inst][header.toLowerCase()] !== null)
                col.innerHTML=sb[inst][header.toLowerCase()];
            else
                col.innerHTML='N/A';
            row.appendChild(col);
        });
        table.appendChild(row);
    }
}

/**
 * Function; printRegisterFile(regFile, htmlTable, title)
 * This function builds an HTML table from a register file (array)
 * Parameters:
 *      regFile - the array of data to be displayed
 *      htmlTable - the HTML id of the table
 *      title - the title to be displayed above the table
 */
function printRegisterFile(regFile, htmlTable, title){
    var rfTable = document.getElementById(htmlTable);
    // Remove any previous cells in the table
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



/***************************************************/
/**************** Scoreboarding loop ***************/
/***************************************************/

/**
* function runScoreboard()
* This function reads the parameters to get the clock cycles required
* for each Functional Unit, then parses the code in order to use it to build
* the scoreboard and display it in a table.
*/
function runScoreboard(){
    // Setup
    fpRegFile = Array(32).fill(0.0);
    intRegFile = Array(32).fill(0);
    dataMem = [45, 12, 0, 0, 10, 135, 254, 127, 18, 4,
                   55, 8, 2, 98, 13, 5, 233, 158, 167];
    IC = 0;
    var clk = 1;
    var pipeline = [];
    var instList = document.getElementById('instruction_input').value;
    var scoreboard = [];
    var ROB = new ReorderBuffer(parseInt(document.getElementById('rob_slots').value));
    hardware = getHardware();
    tag = 0;
    // Split each line into its own instruction and remove empty/commented lines
    instList = instList.split('\n');
    instList = instList.filter(function(inst){
        return (inst.trim() !== '' && inst.trim()[0] !== '#');
    });
    instList = instList.map(function(line){
        try {
            return getInstructionType(line);
        }
        catch (e){
            throw new Error("\nError decoding " + line + " :\n " + e + '\n');
        }
    });
    
    // Loop as long as IC is not at the end of the program and there are
    // instructions in the ROB
    while ((IC < instList.length) || (ROB.getBuffLength() > 0)){
        // Loop through instructions in the ROB to and update their state as necessary
        var instWritten = false; // Only one instruction can be written to the ROB at a time
        for (var inst = 0; inst < ROB.getBuffLength(); inst++){
            var curInst = ROB.getInst(inst);
            // read/execute
            if (curInst.state === "issue" && !curInst.read){
                // otherwise, check if it can read
                var canRead = true;
                var useSrc = null, useTrgt = null;
                for (var i = inst-1; i >= 0; i--){
                    var otherInst = ROB.getInst(i);
                    if (otherInst.dest === curInst.src){
                        if (!otherInst.wb){
                            canRead = false;
                        }
                        else{
                            useSrc = otherInst.result;
                        }
                        break;
                    }
                }
                for (var i = inst-1; i >= 0; i--){
                    var otherInst = ROB.getInst(i);
                    if (otherInst.dest === curInst.trgt){
                        if (!otherInst.wb){
                            canRead = false;
                        }
                        else{
                            useTrgt = otherInst.result;
                        }
                        break;
                    }
                }
                if (canRead){
                    if (curInst.inst === "L.D"){
                        var memLoc;
                        if (useTrgt){
                            var offset = curInst.src.match(/(\d*)\(\$\d+\)/)[1];
                            curInst.hwInUse.inputA = dataMem[parseInt(useTrgt)+parseInt(offset)];
                        }
                        else{
                            curInst.hwInUse.inputA = getValue(curInst.src);
                        }
                    }
                    else{
                        curInst.hwInUse.inputA = (useSrc || getValue(curInst.src));
                    }
                    
                    if (curInst.inst === "S.D")
                        curInst.hwInUse.inputB = (useTrgt || curInst.trgt);
                    else if (curInst.inst === "L.D")
                        curInst.hwInUse.inputB = 0;
                    else
                        curInst.hwInUse.inputB = (useTrgt || getValue(curInst.trgt));
                    curInst.read = true;
                }
            }
            else if (curInst.state === "exec"){
                if (curInst.hwInUse.ready){
                    if (!instWritten){
                        ROB.executeInst(inst);
                        instWritten = true;
                    }
                }
            }
            else if (curInst.state === "wb"){
                curInst.ready = true;
            }
            if (curInst.state === "issue" && curInst.hwInUse.ready && curInst.read){
                curInst.nextState = "exec";
            }
        }
    
    
        
        // Add next element into the pipeline if there is another instruction
        // AND either (nothing is in the pipeline OR the last element in the
        // pipeline has issued)
        if (instList[IC] && !ROB.isFull()){
            var fu;
            hardware.forEach(function(unit){
                if (unit.type === instList[IC].FU){
                    fu = unit;
                }
            });
            if (!fu.isFull()){
                ROB.addInstr(deepCopy(instList[IC]));
                ROB.getLastElement().nextState = "issue";
                IC++;
                
            }
        }
        
        // Update all states of instructions in the ROB and move completed
        // from the ROB to the scoreboard.
        for (var inst in ROB.buffer){
            if (ROB.getInst(inst).state !== ROB.getInst(inst).nextState){
                ROB.getInst(inst).state = ROB.getInst(inst).nextState;
                var newState = ROB.getInst(inst).state;
                ROB.getInst(inst)[newState] = clk;
            }
        }
        
        // Only allow one commit per clk cycle
        var committedInst = ROB.commitNextInst(clk, scoreboard);
        // brute-force way to add the extra cycle in to account for flushing
        // the ROB and issuing the next instruction
        if (committedInst && committedInst.type === "ctrl" && committedInst.result === true){
            clk++;
        }
        hardware.forEach(function (unit){
            unit.removeWritten();
            unit.cycleStation();
        });
        clk++;
        
        if (clk % 1000 == 0 && clk > instList.length*100){
            if (confirm("It looks like you might be in an infinite loop, " +
                        "Would you like to kill it?\n" +
                        "\rclk = " + clk)){
                console.log(hardware);
                console.log(ROB);
                console.log(scoreboard);
                
                return null;
                
            }
            
        }
    }
    scoreboard.sort(function(a, b){
       return (a.issue - b.issue);
    });
    printScoreboard(scoreboard);printRegisterFile(intRegFile, "regFile_table", "RegFile");
    printRegisterFile(fpRegFile, "fpRegFile_table", "FP RegFile");
    printRegisterFile(dataMem, "dataMem_table", "Data Mem");
}


/*******
 *
 * if an instruction is waiting for a src/trgt to be written to,
 * it should take latency after WB for exec completion.
 *
 *
 *
 * ISSUE: L.D Uses old data if src/trgt is updated before it:
SUB.I $1, $1, $1 ; clear $1
SUB.I $2, $1, $1 ; clear $2
ADD.I $1, $1, #16 ; $1 = 16
L.D F9, 1($1)     ; ld dm[17]->f9
MULT.D F0, F1, F0 ; f0 = f1 * f2 <-- Loop dest
ADD.D F4, F0, F2  ; f4 = f0 + f2
S.D F4, 0($2)   ;store f4 -> dm[0+$2]
ADD.I $2, $2, #8 ; $2 = $2 + 8
BNE $1, $2, #4 ; if ($1 != $2) go to Loop dest
DIV.D F11, F9, F9
MULT.D F8, F8, F8
L.D F4, 1($2)
DIV.D F10, F4, F4
    
    or simpler:
sub $1 $1 $1
add.i $1 $1 #5
l.d f4 0($1)
    ^ will load dm[0] instead of the expected dm[5]
 *
 *
 *
 *
 *
 *///
/*
L.D F6 34($2)
L.D F2 20($3)
MULT.D F0 F2 F4
SUB.D F8 F6 F2
DIV.D F10 F0 F6
ADD.D F6 F8 F2

Simple branch






sub.d f0 f0 f0
add.d f1 f0 #2
add.d f0 f0 #1
bne f1 f0 #2
add.i f10 #0 #123
S.D f10 10($2)


more branches:

SUB $1, $1, $1    ; $1 = 0
ADD.I $2, $1, #18 ; $2 = 18
L.D F2 0($2)      ; f2 = dm[18]
L.D F1 0($1)      ; f1 = dm[0]
ADD.I $1 $1 #1    ; $1++
BNE F1 F2 #3      ; (F1 != F2) -> IC = 3;
ADD.D F3 F1 F2
DIV.D F4 F3 #2
BEQ f4 f4 #20 ; ln 8
mult.d f3 f3 #2
mult.d f4 f4 f4
mult.d f1, f2,f3
mult.d f2, f2,f3
mult.d f3, f2,f3
add.d f10 f4 f0
add.d f10 f4 f0
add.d f10 f4 f0
add.d f10 f4 f0
add.d f10 f4 f0
add.d f10 f4 f0
s.d f4 2($0)



SUBI $1, $1, $1
SUBI $2, $1, $1
ADDI $1, $1, #16
L.D F9, 1($1)
MULT.D F0, F1, F0
ADD.D F4, F0, F2
S.D F4, 0($2)
ADDI $2, $2, #8
BNE $1, $2, #4
DIV.D F11, F9, F9
MULT.D F8, F8, F8
L.D F4, 1($2)
DIV.D F10, F4, F4

*/
/*********************************
 *
 * DON'T DELETE THINGS UNTIL BRANCH COMMMITS
 *
 * n - commit branch
 * n+1 - flush ROB
 * n+2 - fetch at new IC
 *
 **********************************/
