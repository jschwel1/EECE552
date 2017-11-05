Computer Design, EECE 552
Mid-semester project: Scoreboarding program
Written by: Jacob Schwell

--------------------------------------
-------------Set Up-------------------
--------------------------------------
Note: This program was tested on Chrome in ChromeOS and Firefox on Ubuntu

1) Since this program uses Javascript and HTML, so it does not need to be compiled. 
2) Ensure the files index.html, scoreboard.js, and README.txt are all in the same directory.
3) From the file browser, open the index.html file in a web browser.
4) Everything should load and the use-instructions below can be used to enter instructions and start the scoreboard.

--------------------------------------
--------Available Instructions--------
--------------------------------------

Memory:
L.D Fd, offset($a) 	| Fd = DM(offset + $a)
S.D Fs, offset($a)	| DM(offset + $a) = Fs

Control:
BEQ $s, $t, dest 	| if ($s == $t) IC = dest
BNE $s, $t, dest 	| if ($s != $t) IC = dest

Arithmetic:
ADD $d, $s, $t		| $d = $s + $t
ADDI $d, $s, #imm	| $d = $s + imm
ADD.D Fd, Fs, Ft	| Fd = Fs + Ft
SUB.D Fd, Fs, Ft	| Fd = Fs - Ft
SUBI $d, $s, $t		| $d = $s - $t
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
1) Enter the latencies for each of the fuctional units
2) Enter Assembly instructions (from those listed above) with their required parameters.
	- Commas can be used, but are not necessary
	- The 'F' for floating point registers is case-insensitive, to use one use Fn, where 0 <= n <= 31
	- For an integer register, use $n, where 0 <= n <= 31
	- For a data memory location, use O($n), where O is any offset and n is any register holding the base address.
	- For an immediate value, the value must be preceded by a '#'.
	- Branch instructions require an absolute address to jump to, not a relative one. The address can be found in a register or be an immediate value.
	- If the program does not seem to run, double check that all instructions are correctly spelled correctly. If it is a caught error, an alert will pop up to inform the user of what happened.
3) To run the code, click the run button. The scoreboard and memory tables will generate at the bottom of the page upon completion.

Note: The register files will initialize to all 0s on page load, but will not be reset between runs, so make sure to only use a register if you know what is in it. Also, branch instructions will always predict not taken, and will use up a cycle to flush out the pipeline if it is taken.

Comments:
The code will only read the necessary parameters for each instruction, so any additional text will be ignored and can be used for comments 
	- E.g. ADD.D F1 F2 F3 ; this is a comment.
 	- Comment/blank lines are ignored by the parser, so they do not count towards branch destinations.

