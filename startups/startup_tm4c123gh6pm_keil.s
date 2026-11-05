;
; startup_tm4c123gh6pm_keil.s
; Startup do TM4C123GH6PM (Cortex-M4F, TI Tiva C) - sintaxe ARMASM (Keil uVision / armasm).
; Vetores da classe TM4C123 tirados do TivaWare 2.2.0.295 (inc/hw_ints.h);
; nem todos os perifericos existem no GH6PM.
;

Stack_Size      EQU     0x00000200

                AREA    STACK, NOINIT, READWRITE, ALIGN=3
Stack_Mem       SPACE   Stack_Size
__initial_sp


Heap_Size       EQU     0x00000000

                AREA    HEAP, NOINIT, READWRITE, ALIGN=3
__heap_base
Heap_Mem        SPACE   Heap_Size
__heap_limit

                PRESERVE8
                THUMB


; tabela de vetores (endereco 0x00000000)
                AREA    RESET, DATA, READONLY
                EXPORT  __Vectors
                EXPORT  __Vectors_End
                EXPORT  __Vectors_Size

__Vectors       DCD     __initial_sp               ; 0: topo da pilha
                DCD     Reset_Handler              ; 1: Reset
                DCD     NMI_Handler                ; 2: NMI
                DCD     HardFault_Handler          ; 3: Hard Fault
                DCD     MemManage_Handler          ; 4: MPU Fault
                DCD     BusFault_Handler           ; 5: Bus Fault
                DCD     UsageFault_Handler         ; 6: Usage Fault
                DCD     0                          ; 7: reservado
                DCD     0                          ; 8: reservado
                DCD     0                          ; 9: reservado
                DCD     0                          ; 10: reservado
                DCD     SVC_Handler                ; 11: SVCall
                DCD     DebugMon_Handler           ; 12: Debug Monitor
                DCD     0                          ; 13: reservado
                DCD     PendSV_Handler             ; 14: PendSV
                DCD     SysTick_Handler            ; 15: SysTick
                DCD     GPIOA_Handler              ; 16: IRQ0 GPIO Port A
                DCD     GPIOB_Handler              ; 17: IRQ1 GPIO Port B
                DCD     GPIOC_Handler              ; 18: IRQ2 GPIO Port C
                DCD     GPIOD_Handler              ; 19: IRQ3 GPIO Port D
                DCD     GPIOE_Handler              ; 20: IRQ4 GPIO Port E
                DCD     UART0_Handler              ; 21: IRQ5 UART0
                DCD     UART1_Handler              ; 22: IRQ6 UART1
                DCD     SSI0_Handler               ; 23: IRQ7 SSI0
                DCD     I2C0_Handler               ; 24: IRQ8 I2C0
                DCD     PWM0_FAULT_Handler         ; 25: IRQ9 PWM0 Fault
                DCD     PWM0_0_Handler             ; 26: IRQ10 PWM0 Generator 0
                DCD     PWM0_1_Handler             ; 27: IRQ11 PWM0 Generator 1
                DCD     PWM0_2_Handler             ; 28: IRQ12 PWM0 Generator 2
                DCD     QEI0_Handler               ; 29: IRQ13 QEI0
                DCD     ADC0SS0_Handler            ; 30: IRQ14 ADC0 Sequence 0
                DCD     ADC0SS1_Handler            ; 31: IRQ15 ADC0 Sequence 1
                DCD     ADC0SS2_Handler            ; 32: IRQ16 ADC0 Sequence 2
                DCD     ADC0SS3_Handler            ; 33: IRQ17 ADC0 Sequence 3
                DCD     WATCHDOG_Handler           ; 34: IRQ18 Watchdog Timers 0 and 1
                DCD     TIMER0A_Handler            ; 35: IRQ19 16/32-Bit Timer 0A
                DCD     TIMER0B_Handler            ; 36: IRQ20 16/32-Bit Timer 0B
                DCD     TIMER1A_Handler            ; 37: IRQ21 16/32-Bit Timer 1A
                DCD     TIMER1B_Handler            ; 38: IRQ22 16/32-Bit Timer 1B
                DCD     TIMER2A_Handler            ; 39: IRQ23 16/32-Bit Timer 2A
                DCD     TIMER2B_Handler            ; 40: IRQ24 16/32-Bit Timer 2B
                DCD     COMP0_Handler              ; 41: IRQ25 Analog Comparator 0
                DCD     COMP1_Handler              ; 42: IRQ26 Analog Comparator 1
                DCD     COMP2_Handler              ; 43: IRQ27 Analog Comparator 2
                DCD     SYSCTL_Handler             ; 44: IRQ28 System Control
                DCD     FLASH_Handler              ; 45: IRQ29 Flash Memory Control and EEPROM
                DCD     GPIOF_Handler              ; 46: IRQ30 GPIO Port F
                DCD     GPIOG_Handler              ; 47: IRQ31 GPIO Port G
                DCD     GPIOH_Handler              ; 48: IRQ32 GPIO Port H
                DCD     UART2_Handler              ; 49: IRQ33 UART2
                DCD     SSI1_Handler               ; 50: IRQ34 SSI1
                DCD     TIMER3A_Handler            ; 51: IRQ35 16/32-Bit Timer 3A
                DCD     TIMER3B_Handler            ; 52: IRQ36 16/32-Bit Timer 3B
                DCD     I2C1_Handler               ; 53: IRQ37 I2C1
                DCD     QEI1_Handler               ; 54: IRQ38 QEI1
                DCD     CAN0_Handler               ; 55: IRQ39 CAN0
                DCD     CAN1_Handler               ; 56: IRQ40 CAN1
                DCD     0                          ; 57: IRQ41 reservado
                DCD     0                          ; 58: IRQ42 reservado
                DCD     HIBERNATE_Handler          ; 59: IRQ43 Hibernation Module
                DCD     USB0_Handler               ; 60: IRQ44 USB
                DCD     PWM0_3_Handler             ; 61: IRQ45 PWM0 Generator 3
                DCD     UDMA_Handler               ; 62: IRQ46 uDMA Software
                DCD     UDMAERR_Handler            ; 63: IRQ47 uDMA Error
                DCD     ADC1SS0_Handler            ; 64: IRQ48 ADC1 Sequence 0
                DCD     ADC1SS1_Handler            ; 65: IRQ49 ADC1 Sequence 1
                DCD     ADC1SS2_Handler            ; 66: IRQ50 ADC1 Sequence 2
                DCD     ADC1SS3_Handler            ; 67: IRQ51 ADC1 Sequence 3
                DCD     0                          ; 68: IRQ52 reservado
                DCD     0                          ; 69: IRQ53 reservado
                DCD     GPIOJ_Handler              ; 70: IRQ54 GPIO Port J
                DCD     GPIOK_Handler              ; 71: IRQ55 GPIO Port K
                DCD     GPIOL_Handler              ; 72: IRQ56 GPIO Port L
                DCD     SSI2_Handler               ; 73: IRQ57 SSI2
                DCD     SSI3_Handler               ; 74: IRQ58 SSI3
                DCD     UART3_Handler              ; 75: IRQ59 UART3
                DCD     UART4_Handler              ; 76: IRQ60 UART4
                DCD     UART5_Handler              ; 77: IRQ61 UART5
                DCD     UART6_Handler              ; 78: IRQ62 UART6
                DCD     UART7_Handler              ; 79: IRQ63 UART7
                DCD     0                          ; 80: IRQ64 reservado
                DCD     0                          ; 81: IRQ65 reservado
                DCD     0                          ; 82: IRQ66 reservado
                DCD     0                          ; 83: IRQ67 reservado
                DCD     I2C2_Handler               ; 84: IRQ68 I2C2
                DCD     I2C3_Handler               ; 85: IRQ69 I2C3
                DCD     TIMER4A_Handler            ; 86: IRQ70 16/32-Bit Timer 4A
                DCD     TIMER4B_Handler            ; 87: IRQ71 16/32-Bit Timer 4B
                DCD     0                          ; 88: IRQ72 reservado
                DCD     0                          ; 89: IRQ73 reservado
                DCD     0                          ; 90: IRQ74 reservado
                DCD     0                          ; 91: IRQ75 reservado
                DCD     0                          ; 92: IRQ76 reservado
                DCD     0                          ; 93: IRQ77 reservado
                DCD     0                          ; 94: IRQ78 reservado
                DCD     0                          ; 95: IRQ79 reservado
                DCD     0                          ; 96: IRQ80 reservado
                DCD     0                          ; 97: IRQ81 reservado
                DCD     0                          ; 98: IRQ82 reservado
                DCD     0                          ; 99: IRQ83 reservado
                DCD     0                          ; 100: IRQ84 reservado
                DCD     0                          ; 101: IRQ85 reservado
                DCD     0                          ; 102: IRQ86 reservado
                DCD     0                          ; 103: IRQ87 reservado
                DCD     0                          ; 104: IRQ88 reservado
                DCD     0                          ; 105: IRQ89 reservado
                DCD     0                          ; 106: IRQ90 reservado
                DCD     0                          ; 107: IRQ91 reservado
                DCD     TIMER5A_Handler            ; 108: IRQ92 16/32-Bit Timer 5A
                DCD     TIMER5B_Handler            ; 109: IRQ93 16/32-Bit Timer 5B
                DCD     WTIMER0A_Handler           ; 110: IRQ94 32/64-Bit Timer 0A
                DCD     WTIMER0B_Handler           ; 111: IRQ95 32/64-Bit Timer 0B
                DCD     WTIMER1A_Handler           ; 112: IRQ96 32/64-Bit Timer 1A
                DCD     WTIMER1B_Handler           ; 113: IRQ97 32/64-Bit Timer 1B
                DCD     WTIMER2A_Handler           ; 114: IRQ98 32/64-Bit Timer 2A
                DCD     WTIMER2B_Handler           ; 115: IRQ99 32/64-Bit Timer 2B
                DCD     WTIMER3A_Handler           ; 116: IRQ100 32/64-Bit Timer 3A
                DCD     WTIMER3B_Handler           ; 117: IRQ101 32/64-Bit Timer 3B
                DCD     WTIMER4A_Handler           ; 118: IRQ102 32/64-Bit Timer 4A
                DCD     WTIMER4B_Handler           ; 119: IRQ103 32/64-Bit Timer 4B
                DCD     WTIMER5A_Handler           ; 120: IRQ104 32/64-Bit Timer 5A
                DCD     WTIMER5B_Handler           ; 121: IRQ105 32/64-Bit Timer 5B
                DCD     SYSEXC_Handler             ; 122: IRQ106 System Exception (imprecise)
                DCD     0                          ; 123: IRQ107 reservado
                DCD     0                          ; 124: IRQ108 reservado
                DCD     I2C4_Handler               ; 125: IRQ109 I2C4
                DCD     I2C5_Handler               ; 126: IRQ110 I2C5
                DCD     GPIOM_Handler              ; 127: IRQ111 GPIO Port M
                DCD     GPION_Handler              ; 128: IRQ112 GPIO Port N
                DCD     0                          ; 129: IRQ113 reservado
                DCD     0                          ; 130: IRQ114 reservado
                DCD     0                          ; 131: IRQ115 reservado
                DCD     GPIOP0_Handler             ; 132: IRQ116 GPIO Port P (Summary or P0)
                DCD     GPIOP1_Handler             ; 133: IRQ117 GPIO Port P1
                DCD     GPIOP2_Handler             ; 134: IRQ118 GPIO Port P2
                DCD     GPIOP3_Handler             ; 135: IRQ119 GPIO Port P3
                DCD     GPIOP4_Handler             ; 136: IRQ120 GPIO Port P4
                DCD     GPIOP5_Handler             ; 137: IRQ121 GPIO Port P5
                DCD     GPIOP6_Handler             ; 138: IRQ122 GPIO Port P6
                DCD     GPIOP7_Handler             ; 139: IRQ123 GPIO Port P7
                DCD     GPIOQ0_Handler             ; 140: IRQ124 GPIO Port Q (Summary or Q0)
                DCD     GPIOQ1_Handler             ; 141: IRQ125 GPIO Port Q1
                DCD     GPIOQ2_Handler             ; 142: IRQ126 GPIO Port Q2
                DCD     GPIOQ3_Handler             ; 143: IRQ127 GPIO Port Q3
                DCD     GPIOQ4_Handler             ; 144: IRQ128 GPIO Port Q4
                DCD     GPIOQ5_Handler             ; 145: IRQ129 GPIO Port Q5
                DCD     GPIOQ6_Handler             ; 146: IRQ130 GPIO Port Q6
                DCD     GPIOQ7_Handler             ; 147: IRQ131 GPIO Port Q7
                DCD     0                          ; 148: IRQ132 reservado
                DCD     0                          ; 149: IRQ133 reservado
                DCD     PWM1_0_Handler             ; 150: IRQ134 PWM1 Generator 0
                DCD     PWM1_1_Handler             ; 151: IRQ135 PWM1 Generator 1
                DCD     PWM1_2_Handler             ; 152: IRQ136 PWM1 Generator 2
                DCD     PWM1_3_Handler             ; 153: IRQ137 PWM1 Generator 3
                DCD     PWM1_FAULT_Handler         ; 154: IRQ138 PWM1 Fault
__Vectors_End

__Vectors_Size  EQU     __Vectors_End - __Vectors

                AREA    |.text|, CODE, READONLY

; Reset: liga a FPU e salta para o __main (que copia .data e zera .bss)
Reset_Handler   PROC
                EXPORT  Reset_Handler              [WEAK]
                IMPORT  __main

                LDR     R0, =0xE000ED88            ; CPACR
                LDR     R1, [R0]
                ORR     R1, R1, #0x00F00000        ; CP10 e CP11 com acesso total
                STR     R1, [R0]
                DSB
                ISB

                LDR     R0, =__main
                BX      R0
                ENDP

; handlers fracos (lacos infinitos que podem ser substituidos)

NMI_Handler     PROC
                EXPORT  NMI_Handler                [WEAK]
                B       .
                ENDP
HardFault_Handler PROC
                EXPORT  HardFault_Handler          [WEAK]
                B       .
                ENDP
MemManage_Handler PROC
                EXPORT  MemManage_Handler          [WEAK]
                B       .
                ENDP
BusFault_Handler PROC
                EXPORT  BusFault_Handler           [WEAK]
                B       .
                ENDP
UsageFault_Handler PROC
                EXPORT  UsageFault_Handler         [WEAK]
                B       .
                ENDP
SVC_Handler     PROC
                EXPORT  SVC_Handler                [WEAK]
                B       .
                ENDP
DebugMon_Handler PROC
                EXPORT  DebugMon_Handler           [WEAK]
                B       .
                ENDP
PendSV_Handler  PROC
                EXPORT  PendSV_Handler             [WEAK]
                B       .
                ENDP
SysTick_Handler PROC
                EXPORT  SysTick_Handler            [WEAK]
                B       .
                ENDP

Default_Handler PROC

                EXPORT  GPIOA_Handler              [WEAK]
                EXPORT  GPIOB_Handler              [WEAK]
                EXPORT  GPIOC_Handler              [WEAK]
                EXPORT  GPIOD_Handler              [WEAK]
                EXPORT  GPIOE_Handler              [WEAK]
                EXPORT  UART0_Handler              [WEAK]
                EXPORT  UART1_Handler              [WEAK]
                EXPORT  SSI0_Handler               [WEAK]
                EXPORT  I2C0_Handler               [WEAK]
                EXPORT  PWM0_FAULT_Handler         [WEAK]
                EXPORT  PWM0_0_Handler             [WEAK]
                EXPORT  PWM0_1_Handler             [WEAK]
                EXPORT  PWM0_2_Handler             [WEAK]
                EXPORT  QEI0_Handler               [WEAK]
                EXPORT  ADC0SS0_Handler            [WEAK]
                EXPORT  ADC0SS1_Handler            [WEAK]
                EXPORT  ADC0SS2_Handler            [WEAK]
                EXPORT  ADC0SS3_Handler            [WEAK]
                EXPORT  WATCHDOG_Handler           [WEAK]
                EXPORT  TIMER0A_Handler            [WEAK]
                EXPORT  TIMER0B_Handler            [WEAK]
                EXPORT  TIMER1A_Handler            [WEAK]
                EXPORT  TIMER1B_Handler            [WEAK]
                EXPORT  TIMER2A_Handler            [WEAK]
                EXPORT  TIMER2B_Handler            [WEAK]
                EXPORT  COMP0_Handler              [WEAK]
                EXPORT  COMP1_Handler              [WEAK]
                EXPORT  COMP2_Handler              [WEAK]
                EXPORT  SYSCTL_Handler             [WEAK]
                EXPORT  FLASH_Handler              [WEAK]
                EXPORT  GPIOF_Handler              [WEAK]
                EXPORT  GPIOG_Handler              [WEAK]
                EXPORT  GPIOH_Handler              [WEAK]
                EXPORT  UART2_Handler              [WEAK]
                EXPORT  SSI1_Handler               [WEAK]
                EXPORT  TIMER3A_Handler            [WEAK]
                EXPORT  TIMER3B_Handler            [WEAK]
                EXPORT  I2C1_Handler               [WEAK]
                EXPORT  QEI1_Handler               [WEAK]
                EXPORT  CAN0_Handler               [WEAK]
                EXPORT  CAN1_Handler               [WEAK]
                EXPORT  HIBERNATE_Handler          [WEAK]
                EXPORT  USB0_Handler               [WEAK]
                EXPORT  PWM0_3_Handler             [WEAK]
                EXPORT  UDMA_Handler               [WEAK]
                EXPORT  UDMAERR_Handler            [WEAK]
                EXPORT  ADC1SS0_Handler            [WEAK]
                EXPORT  ADC1SS1_Handler            [WEAK]
                EXPORT  ADC1SS2_Handler            [WEAK]
                EXPORT  ADC1SS3_Handler            [WEAK]
                EXPORT  GPIOJ_Handler              [WEAK]
                EXPORT  GPIOK_Handler              [WEAK]
                EXPORT  GPIOL_Handler              [WEAK]
                EXPORT  SSI2_Handler               [WEAK]
                EXPORT  SSI3_Handler               [WEAK]
                EXPORT  UART3_Handler              [WEAK]
                EXPORT  UART4_Handler              [WEAK]
                EXPORT  UART5_Handler              [WEAK]
                EXPORT  UART6_Handler              [WEAK]
                EXPORT  UART7_Handler              [WEAK]
                EXPORT  I2C2_Handler               [WEAK]
                EXPORT  I2C3_Handler               [WEAK]
                EXPORT  TIMER4A_Handler            [WEAK]
                EXPORT  TIMER4B_Handler            [WEAK]
                EXPORT  TIMER5A_Handler            [WEAK]
                EXPORT  TIMER5B_Handler            [WEAK]
                EXPORT  WTIMER0A_Handler           [WEAK]
                EXPORT  WTIMER0B_Handler           [WEAK]
                EXPORT  WTIMER1A_Handler           [WEAK]
                EXPORT  WTIMER1B_Handler           [WEAK]
                EXPORT  WTIMER2A_Handler           [WEAK]
                EXPORT  WTIMER2B_Handler           [WEAK]
                EXPORT  WTIMER3A_Handler           [WEAK]
                EXPORT  WTIMER3B_Handler           [WEAK]
                EXPORT  WTIMER4A_Handler           [WEAK]
                EXPORT  WTIMER4B_Handler           [WEAK]
                EXPORT  WTIMER5A_Handler           [WEAK]
                EXPORT  WTIMER5B_Handler           [WEAK]
                EXPORT  SYSEXC_Handler             [WEAK]
                EXPORT  I2C4_Handler               [WEAK]
                EXPORT  I2C5_Handler               [WEAK]
                EXPORT  GPIOM_Handler              [WEAK]
                EXPORT  GPION_Handler              [WEAK]
                EXPORT  GPIOP0_Handler             [WEAK]
                EXPORT  GPIOP1_Handler             [WEAK]
                EXPORT  GPIOP2_Handler             [WEAK]
                EXPORT  GPIOP3_Handler             [WEAK]
                EXPORT  GPIOP4_Handler             [WEAK]
                EXPORT  GPIOP5_Handler             [WEAK]
                EXPORT  GPIOP6_Handler             [WEAK]
                EXPORT  GPIOP7_Handler             [WEAK]
                EXPORT  GPIOQ0_Handler             [WEAK]
                EXPORT  GPIOQ1_Handler             [WEAK]
                EXPORT  GPIOQ2_Handler             [WEAK]
                EXPORT  GPIOQ3_Handler             [WEAK]
                EXPORT  GPIOQ4_Handler             [WEAK]
                EXPORT  GPIOQ5_Handler             [WEAK]
                EXPORT  GPIOQ6_Handler             [WEAK]
                EXPORT  GPIOQ7_Handler             [WEAK]
                EXPORT  PWM1_0_Handler             [WEAK]
                EXPORT  PWM1_1_Handler             [WEAK]
                EXPORT  PWM1_2_Handler             [WEAK]
                EXPORT  PWM1_3_Handler             [WEAK]
                EXPORT  PWM1_FAULT_Handler         [WEAK]

GPIOA_Handler
GPIOB_Handler
GPIOC_Handler
GPIOD_Handler
GPIOE_Handler
UART0_Handler
UART1_Handler
SSI0_Handler
I2C0_Handler
PWM0_FAULT_Handler
PWM0_0_Handler
PWM0_1_Handler
PWM0_2_Handler
QEI0_Handler
ADC0SS0_Handler
ADC0SS1_Handler
ADC0SS2_Handler
ADC0SS3_Handler
WATCHDOG_Handler
TIMER0A_Handler
TIMER0B_Handler
TIMER1A_Handler
TIMER1B_Handler
TIMER2A_Handler
TIMER2B_Handler
COMP0_Handler
COMP1_Handler
COMP2_Handler
SYSCTL_Handler
FLASH_Handler
GPIOF_Handler
GPIOG_Handler
GPIOH_Handler
UART2_Handler
SSI1_Handler
TIMER3A_Handler
TIMER3B_Handler
I2C1_Handler
QEI1_Handler
CAN0_Handler
CAN1_Handler
HIBERNATE_Handler
USB0_Handler
PWM0_3_Handler
UDMA_Handler
UDMAERR_Handler
ADC1SS0_Handler
ADC1SS1_Handler
ADC1SS2_Handler
ADC1SS3_Handler
GPIOJ_Handler
GPIOK_Handler
GPIOL_Handler
SSI2_Handler
SSI3_Handler
UART3_Handler
UART4_Handler
UART5_Handler
UART6_Handler
UART7_Handler
I2C2_Handler
I2C3_Handler
TIMER4A_Handler
TIMER4B_Handler
TIMER5A_Handler
TIMER5B_Handler
WTIMER0A_Handler
WTIMER0B_Handler
WTIMER1A_Handler
WTIMER1B_Handler
WTIMER2A_Handler
WTIMER2B_Handler
WTIMER3A_Handler
WTIMER3B_Handler
WTIMER4A_Handler
WTIMER4B_Handler
WTIMER5A_Handler
WTIMER5B_Handler
SYSEXC_Handler
I2C4_Handler
I2C5_Handler
GPIOM_Handler
GPION_Handler
GPIOP0_Handler
GPIOP1_Handler
GPIOP2_Handler
GPIOP3_Handler
GPIOP4_Handler
GPIOP5_Handler
GPIOP6_Handler
GPIOP7_Handler
GPIOQ0_Handler
GPIOQ1_Handler
GPIOQ2_Handler
GPIOQ3_Handler
GPIOQ4_Handler
GPIOQ5_Handler
GPIOQ6_Handler
GPIOQ7_Handler
PWM1_0_Handler
PWM1_1_Handler
PWM1_2_Handler
PWM1_3_Handler
PWM1_FAULT_Handler

                B       .

                ENDP

                ALIGN

; pilha e heap para a biblioteca C
                IF      :DEF:__MICROLIB

                EXPORT  __initial_sp
                EXPORT  __heap_base
                EXPORT  __heap_limit

                ELSE

                IMPORT  __use_two_region_memory
                EXPORT  __user_initial_stackheap

__user_initial_stackheap

                LDR     R0, =  Heap_Mem
                LDR     R1, =(Stack_Mem + Stack_Size)
                LDR     R2, = (Heap_Mem +  Heap_Size)
                LDR     R3, = Stack_Mem
                BX      LR

                ALIGN

                ENDIF

                END
