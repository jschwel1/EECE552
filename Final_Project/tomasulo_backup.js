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
            throw "Wrong Reservation Station: This="+this.type+", Inst="+inst.FU;
        }
        if (this.rs.length() == this.maxSize){
            return false;
        }
        else {
            this.rs.push({inst:inst.inst, src:inst.src, trgt:inst.trgt,
                          cycle:getLatency(this.type), ready:false});
        }
    }
    isFull(){
        return (this.rs.length() == this.maxSize);
    }
    cycleStation(){
        if (pipelined){
            this.rs.foreach(function(rsSlot){
                if (rsSlot.cycle > 0)
                    rsSlot.cycle--;
                else
                    rsSlot.ready = true;
            });
        }
        else {
            if (this.rs.length > 0){
                if (this.rs[0].cycle > 0)
                    this.rs[0].cycle--;
                else
                    this.rs[0].ready = true;
            }
        }
    }
}

class ReorderBuffer {
    element(inst, dest){
        return{
            inst: inst,
            dest: dest,
            val: null,
            ready: false
        }
    }
    constructor(maxSize){
        this.maxSize = maxSize;
        this.buffer = [];
    }
    isFull(){
        return (this.buffer.length == this.maxSize);
    }
    addInstr(inst, dest){
        var e = element(inst, dest);
        if (!isFull()) this.buffer.push(e);
        return e;
    }
    getInst(n){
        return this.buffer[n];
    }
    getBuffLength(){
        return this.buffer.length;
    }
    clearBranch(){
     for (var element in this.buffer){
        if (!(   element.ready
             &&    ((element.inst === 'BNE')
                 || (element.inst === 'BEQ')))) continue;
         
            if (        ((element.inst === 'BEQ')
                    &&  (element.val === true))
                ||      ((element.inst === 'BNE' )
                    &&  (element.val === false))){
                return this.buffer.splice(this.buffer.length-element+1);
            }
        }
        return false;
    }
    removeNext(){
        if ((this.buffer[0] !== null) && (this.buffer[0].ready)){
            return this.buffer.splice(0,1);
        }
        return null;
    }
}

// Global variables that are accessed by multiple functions
var fpRegFile = Array(32).fill(0.0);
var intRegFile = Array(32).fill(0);
var dataMem = [45, 12, 0, 0, 10, 135, 254, 127, 18, 4,
               55, 8, 2, 98, 13, 5, 233, 158, 167];
var IC = 0;

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
    }
}

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
    var pipeline = [];
    var instList = document.getElementById('instruction_input').value;
    var scoreboard = [];
    var ROB = new ReorderBuffer(parseInt(document.getElementById('rob_slots').value));
    var hardware = getHardware();
    
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
            throw "\nError decoding " + line + " :\n " + e + '\n';
        }
    });
    
    // Loop as long as IC is not at the end of the program and there are
    // instructions in the ROB
    while ((IC < instList.length) || (ROB.length > 0)){
        // Loop through every instruction in the pipeline
        for (var inst in ROB){
            // Although Tomasulo's combines read and execute, they will remain
            // separate here to maintain simplicity
            if (ROB[inst].state == "issue"){
                var hasSrc = true;
                var hasTrgt = true;
                for (var otherInst = inst-1; otherInst >= 0; otherInst--){
                    if (ROB[otherInst].dest === ROB[inst].src){
                        if (ROB[otherInst].ready){
                            ROB[inst]
                        }
                    }
                    
                    if (ROB[otherInst].dest === ROB[inst].trgt){
                        canRead = false;
                        break;
                    }
                }
                if (canRead){
                    try {
                        ROB[inst].nextState = "read";
                        // Add the latency to the HW
                        hardware[ROB[inst].FU].busy = hardwareLatency[pipeline[inst].FU];
                        // Input A = source value
                        hardware[pipeline[inst].FU].inputA = getValue(pipeline[inst].src);
                        // Input B = target value (or mem address for s.d)
                        if (pipeline[inst].inst === "S.D"){
                            hardware[pipeline[inst].FU].inputB = pipeline[inst].trgt;
                        }
                        else {
                            hardware[pipeline[inst].FU].inputB = getValue(pipeline[inst].trgt);
                        }
                        // Save the instruction in the HW too
                        hardware[pipeline[inst].FU].inst = pipeline[inst].inst;
                    }
                    catch (e) {
                        throw e+"\nInstruction:" + pipeline[inst].inst + "\n";
                    }
                }
            }
            // The instruction will stay in read until it's HW timer
            // reaches 0
            else if (pipeline[inst].state === "read"){
                if (hardware[pipeline[inst].FU].busy > 1){
                    hardware[pipeline[inst].FU].busy--;
                }
                else {
                    // Since no other instruction can execute as long as there
                    // is an instruction in the pipeline using the same FU,
                    // nothing will "execute" until the WB state
                    pipeline[inst].nextState = "exec";
                    hardware[pipeline[inst].FU].busy = 0;
                }
            }
            //////////////////////////////////////////////////////////////////
            //////////////////////////////////////////////////////////////////
            //////////////////////////////////////////////////////////////////
            //////////////////////////////////////////////////////////////////
            //////////////////////////////////////////////////////////////////
            // Before writing the output, check for WAR (Ensure no instruction
            // that is waiting to read has this instruction dest as an input)
            // and no writing if a branch is still waiting to write
            else if (pipeline[inst].state == "exec"){
                var canWrite = true;
                for (var otherInst in pipeline){
                    if (otherInst >= inst) break;
                    if (    pipeline[inst].dest === pipeline[otherInst].src
                        ||  pipeline[inst].dest === pipeline[otherInst].trgt
                        ||  pipeline[otherInst].type === "ctrl"){
                        // if it was not a branch/control instruction and
                        // it already read, the instruction can write
                        if (!((pipeline[otherInst].type !== "ctrl") && (pipeline[otherInst].read !== null))){
                            canWrite = false;
                            break;
                        }
                    }
                }
                if (canWrite){
                    pipeline[inst].nextState = "wb";
                    var fu = hardware[pipeline[inst].FU];
                    var result = executeInstruction(fu.inst, fu.inputA, fu.inputB, pipeline[inst].dest);
                    // Flush ROB and add to scoreboard (the scoreboard will be sorted by issue at the end)
                    if (pipeline[inst].type === "ctrl" && result === true){
                        var removed = pipeline.splice(inst+1, pipeline.length-inst);
                        removed.forEach(function(remInstr){
                            // Of the instructions removed from the pipeline, make sure
                            // they actually issued before putting onto the scoreboard
                            if (remInstr.issue !== null)
                                scoreboard.push(deepCopy(remInstr));
                        });
                    }
                    
                }
            }
        }
            
        // Add next element into the pipeline if there is another instruction
        // AND either (nothing is in the pipeline OR the last element in the
        // pipeline has issued)
        if (((instList[IC]) && (ROB.getBuffLength === 0))
            || (ROB.getInst(ROB.getBuffLength).issue !== null)){
                
            var canIssue = ((!hardware[ROB[inst].FU].isFull())
                            && (!ROB.isFull()));
            if (canIssue){
                ROB.push(deepCopy(instList[IC]));
                ROB[ROB.length-1].nextState = "issue";
                IC++;
            }
        }
        
        // Update all states of instructions in the ROB and move completed
        // from the ROB to the scoreboard.
        for (var inst in ROB){
            if (ROB[inst].state !== ROB[inst].nextState){
                ROB[inst].state = ROB[inst].nextState;
                ROB[inst][ROB[inst].state] = clk;
            }
        }
        // Only allow one commit per clk cycle
        var committedInst = ROB.removeNext();
        if (committedInst !== null){
            scoreboard.push(committedInst);
        }
        for (var inst in ROB){
            if (ROB[inst].ready){
                var written = pipeline.splice(inst, 1)[0];
                written.wb = clk;
                scoreboard.push(written);
                break;
            }
        }
        clk++;
        
        if (clk % 10000 == 0 && clk > instList.length*100){
            if (confirm("It looks like you might be in an infinite loop, " +
                        "Would you like to kill it?\n" +
                        "\rclk = " + clk)){
                return null;
            }
            
        }
        
    }
    // Since instructions were put in the scoreboard at different times (done at
    // WB), they need to be sorted by issue clk cycles
    scoreboard.sort(function(a, b){
       return (a.issue - b.issue);
    });
    printScoreboard(scoreboard);
    printRegisterFile(intRegFile, "regFile_table", "RegFile");
    printRegisterFile(fpRegFile, "fpRegFile_table", "FP RegFile");
    printRegisterFile(dataMem, "dataMem_table", "Data Mem");
    return instList;
}

/**
* function getHardwareLatencies()
* This function reads the textareas in the HTML page to obtain the latenies
* for each type of hardware. Since this project only uses one of each type,
*
*/
function getHardware(){
    var hardware = [];
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
    console.log(hardware);
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
        instructionObject = {type:"mem", dest:parsed[1], src:parsed[2],
                             trgt:null, FU:"load"};
    }
    else if (parsed[0] == "S.D"){
        var regVal = parsed[2].match(/(\$\d+)/);
        instructionObject = {type:"mem", dest:regVal[0], src:parsed[1],
                             trgt:parsed[2], FU:"store"};
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
                throw ("Unknown Instruction: " + instruction);
            }
        }
        else{
            instructionObject = {type:"alu_r", src:parsed[2], trgt:parsed[3],
                                 dest:parsed[1], FU:"integer"};
        }
    }
    instructionObject.inst = parsed[0];
    instructionObject.issue = null;
    instructionObject.exec = null;
    instructionObject.wb = null;
    instructionObject.commit = null;
    instructionObject.state = "waiting";
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
    var parsedInput = location.match(/(\d*)\(\$(\d)\)/);
    if (parsedInput){
        index = parseInt(intRegFile[parsedInput[2]]);
        offset = parseInt(parsedInput[1]);
        return (parseInt(dataMem[index+offset]) || 0);
    }
    
    throw ("Could not obtain a value from \"" + location +
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
    var parsedInput = location.match(/(\d*)\(\$(\d)\)/);
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
        return setValue(destLoc, srcVal);
    }
    if (inst === "S.D"){
        return setValue(trgtVal, srcVal);
    }
    if (inst === "BEQ"){
        if (srcVal === trgtVal){
            IC = getValue(destLoc);
            return true;
        }
        return false;
    }
    if (inst === "BNE"){
        if (srcVal !== trgtVal){
            IC = getValue(destLoc);
            return true;
        }
        return false;
    }
    // Javascript will uses the same arithmetic operators for float and
    // integers, so just check the operator. setValue() will ensure it gets
    // saved as a float or int.
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
