Computer Design, EECE 552, Project 1

Written by: Jacob Schwell

--------------------------------------
--------Available Instructions--------
--------------------------------------

L.D Fd, offset($a) 	| Fd = DM(offset + $a)
S.D Fs, offset($a)	| DM(offset + $a) = Fs

BEQ $s, $t, dest 	| if ($s == $t) IC = dest
BNE $s, $t, dest 	| if ($s != $t) IC = dest

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
Data Memory: addresses={0,...,18}

NOTE: $0 acts as any other register, rather than only storing 0

--------------------------------------
--------How to Use--------------------
--------------------------------------
Start by entering the latencies for each of the functional units, then enter an instruction followed by the necessary parameters. Commas can be used, but are not required. The 'f' in floating point registers is case insensitive. For memory locations, an offset must be in place (e.g. 16($3), but can be 0).

To run the code, click the run code button. The scoreboard and memory tables will generate upon completion.

Note: The register files will initialize to all 0s on page load, but will not be reset between runs, so make sure to only use a register if you know what is in it.

Comments:
The code will only read the necessary parameters for each instruction, so any additional text will be ignored and can be used for comments (e.g. ADD.D F1 F2 F3 ; this is a comment). 
Important Note: Comment lines are ignored by the parser, so they do not count towards branch destinations.


--------------------------------------
--------Future Updates----------------
--------------------------------------
	- Make hardware object, and give each a type, then make array of HW available, so multiple FUs of each type can be used
