Computer Design, EECE 552
Final project: Scoreboarding with Tomasulo's Algorithm and Reorder Buffer
Written by: Jacob Schwell

--------------------------------------
-------------Set Up-------------------
--------------------------------------

Note: This program was tested on Chrome in ChromeOS, Firefox on Ubuntu, and Chrome on Windows 8.1, but should work on any OS and browser capable of running Javascript.

1) Since this program uses Javascript and HTML, it does not need to be compiled.
2) Ensure the files index.html, tomasulo.js, and README.html are all in the same directory.
3) From the file browser, open the index.html file in a web browser.
4) Everything should load and the use-instructions below can be used to enter instructions and start the scoreboard.
    - This document is available in a formatted version in the README/Instruction link in index.html (or see README.html directly)


--------------------------------------
--------Available Instructions--------
--------------------------------------

Memory:
L.D Fd, offset($a) | Fd = DM(offset + $a)
S.D Fs, offset($a)	| DM(offset + $a) = Fs
Control:
BEQ $s, $t, dest | if ($s == $t) IC = dest
BNE $s, $t, dest | if ($s != $t) IC = dest
Arithmetic:
ADD $d, $s, $t	| $d = $s + $t
ADDI $d, $s, #imm	| $d = $s + imm
ADD.D Fd, Fs, Ft	| Fd = Fs + Ft
SUB.D Fd, Fs, Ft	| Fd = Fs - Ft
SUBI $d, $s, $t	| $d = $s - $t
MULT.D Fd, Fs, Ft	| Fd = Fs * Fd
DIV.D Fd, Fs, Ft	| Fd = Fs / Ft

--------------------------------------
--------Available Registers-----------
--------------------------------------

Floating point registers Fd, d={0,...,31}
Integer registers $d, d={0,...,31}
Data Memory: offset($d)=$d+offset -- available addresses={0,...,18}
Immediate Value: #v, v=any immediate value
Note: $0 acts as any other register, rather than only storing 0

--------------------------------------
--------How to Use--------------------
--------------------------------------

1) Enter the latencies and number of reservation stations for each of the fuctional units and the total number of slots in the Reorder Buffer
2) Enter Assembly instructions (from those listed above) with their required parameters.
    - Commas can be used, but are not necessary
    - The 'F' for floating point registers is case-insensitive, to use one use Fn, where 0 <= n <= 31
    - For an integer register, use $n, where 0 <= n <= 31
    - For a data memory location, use O($n), where O is any offset and n is any register holding the base address
    - For an immediate value, the value must be preceded by a '#'
    - Branch instructions require an absolute address to jump to, not a relative one. The address can be found in a register or be an immediate value.
    - If the program does not seem to run, double check that all instructions are correctly spelled correctly. If it is a caught error, an alert will pop up to inform the user of what happened. In that event, JavaScript Developer console will also print out the stack to help pinpoint the source of the error.
3) To run the code, click the run button. The scoreboard and memory tables will generate at the bottom of the page upon completion.

Note: The register files will initialize to all 0s every time the the assembly code is run and will, therefore, lose all previous data, so make sure to only use a register if you know what is in it. Also, branch instructions will always predict not taken. If a branch is taken, it will require one cycle to flush the ROB, then fetch the next instruction on the following cycle. Branches are either taken or not taken once committed.

Comments:
- The code will only read the necessary parameters for each instruction, so any additional text will be ignored and can be used for comments
    E.g. ADD.D F1 F2 F3 ; this is a comment.
- Comment/blank lines are ignored by the parser, so they do not count towards branch destinations.

--------------------------------------
--------Sample Code-------------------
--------------------------------------

SUB $1, $1, $1
SUB $2, $1, $1
ADD.I $1, $1, #16
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
