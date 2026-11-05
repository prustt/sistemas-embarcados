; startup_tm4c1294ncpdt_keil.s
; Startup do TM4C1294NCPDT (Cortex-M4F, EK-TM4C1294XL)
; Sintaxe ARMASM (Keil uVision / armasm). O __main da biblioteca C copia
; .data, zera .bss e chama main.
; Vetores tirados do TivaWare 2.2.0.295, inc/hw_ints.h (INT_*_TM4C129).

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

                ; interrupcoes dos perifericos (IRQn = posicao - 16)
                DCD     GPIOA_Handler              ; 16: IRQ0 GPIO Port A
                DCD     GPIOB_Handler              ; 17: IRQ1 GPIO Port B
                DCD     GPIOC_Handler              ; 18: IRQ2 GPIO Port C
                DCD     GPIOD_Handler              ; 19: IRQ3 GPIO Port D
                DCD     GPIOE_Handler              ; 20: IRQ4 GPIO Port E
                DCD     UART0_Handler              ; 21: IRQ5 UART0
                DCD     UART1_Handler              ; 22: IRQ6 UART1
                DCD     SSI0_Handler               ; 23: IRQ7 SSI0
                DCD     I2C0_Handler               ; 24: IRQ8 I2C0
                DCD     PWM0_FAULT_Handler         ; 25: IRQ9 PWM Fault
                DCD     PWM0_0_Handler             ; 26: IRQ10 PWM Generator 0
                DCD     PWM0_1_Handler             ; 27: IRQ11 PWM Generator 1
                DCD     PWM0_2_Handler             ; 28: IRQ12 PWM Generator 2
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
                DCD     FLASH_Handler              ; 45: IRQ29 Flash Memory Control
                DCD     GPIOF_Handler              ; 46: IRQ30 GPIO Port F
                DCD     GPIOG_Handler              ; 47: IRQ31 GPIO Port G
                DCD     GPIOH_Handler              ; 48: IRQ32 GPIO Port H
                DCD     UART2_Handler              ; 49: IRQ33 UART2
                DCD     SSI1_Handler               ; 50: IRQ34 SSI1
                DCD     TIMER3A_Handler            ; 51: IRQ35 16/32-Bit Timer 3A
                DCD     TIMER3B_Handler            ; 52: IRQ36 16/32-Bit Timer 3B
                DCD     I2C1_Handler               ; 53: IRQ37 I2C1
                DCD     CAN0_Handler               ; 54: IRQ38 CAN 0
                DCD     CAN1_Handler               ; 55: IRQ39 CAN1
                DCD     EMAC0_Handler              ; 56: IRQ40 Ethernet MAC
                DCD     HIBERNATE_Handler          ; 57: IRQ41 HIB
                DCD     USB0_Handler               ; 58: IRQ42 USB MAC
                DCD     PWM0_3_Handler             ; 59: IRQ43 PWM Generator 3
                DCD     UDMA_Handler               ; 60: IRQ44 uDMA 0 Software
                DCD     UDMAERR_Handler            ; 61: IRQ45 uDMA 0 Error
                DCD     ADC1SS0_Handler            ; 62: IRQ46 ADC1 Sequence 0
                DCD     ADC1SS1_Handler            ; 63: IRQ47 ADC1 Sequence 1
                DCD     ADC1SS2_Handler            ; 64: IRQ48 ADC1 Sequence 2
                DCD     ADC1SS3_Handler            ; 65: IRQ49 ADC1 Sequence 3
                DCD     EPI0_Handler               ; 66: IRQ50 EPI 0
                DCD     GPIOJ_Handler              ; 67: IRQ51 GPIO Port J
                DCD     GPIOK_Handler              ; 68: IRQ52 GPIO Port K
                DCD     GPIOL_Handler              ; 69: IRQ53 GPIO Port L
                DCD     SSI2_Handler               ; 70: IRQ54 SSI 2
                DCD     SSI3_Handler               ; 71: IRQ55 SSI 3
                DCD     UART3_Handler              ; 72: IRQ56 UART 3
                DCD     UART4_Handler              ; 73: IRQ57 UART 4
                DCD     UART5_Handler              ; 74: IRQ58 UART 5
                DCD     UART6_Handler              ; 75: IRQ59 UART 6
                DCD     UART7_Handler              ; 76: IRQ60 UART 7
                DCD     I2C2_Handler               ; 77: IRQ61 I2C 2
                DCD     I2C3_Handler               ; 78: IRQ62 I2C 3
                DCD     TIMER4A_Handler            ; 79: IRQ63 Timer 4A
                DCD     TIMER4B_Handler            ; 80: IRQ64 Timer 4B
                DCD     TIMER5A_Handler            ; 81: IRQ65 Timer 5A
                DCD     TIMER5B_Handler            ; 82: IRQ66 Timer 5B
                DCD     SYSEXC_Handler             ; 83: IRQ67 Floating-Point Exception
                DCD     0                          ; 84: IRQ68 reservado
                DCD     0                          ; 85: IRQ69 reservado
                DCD     I2C4_Handler               ; 86: IRQ70 I2C 4
                DCD     I2C5_Handler               ; 87: IRQ71 I2C 5
                DCD     GPIOM_Handler              ; 88: IRQ72 GPIO Port M
                DCD     GPION_Handler              ; 89: IRQ73 GPIO Port N
                DCD     0                          ; 90: IRQ74 reservado
                DCD     TAMPER0_Handler            ; 91: IRQ75 Tamper
                DCD     GPIOP0_Handler             ; 92: IRQ76 GPIO Port P (Summary or P0)
                DCD     GPIOP1_Handler             ; 93: IRQ77 GPIO Port P1
                DCD     GPIOP2_Handler             ; 94: IRQ78 GPIO Port P2
                DCD     GPIOP3_Handler             ; 95: IRQ79 GPIO Port P3
                DCD     GPIOP4_Handler             ; 96: IRQ80 GPIO Port P4
                DCD     GPIOP5_Handler             ; 97: IRQ81 GPIO Port P5
                DCD     GPIOP6_Handler             ; 98: IRQ82 GPIO Port P6
                DCD     GPIOP7_Handler             ; 99: IRQ83 GPIO Port P7
                DCD     GPIOQ0_Handler             ; 100: IRQ84 GPIO Port Q (Summary or Q0)
                DCD     GPIOQ1_Handler             ; 101: IRQ85 GPIO Port Q1
                DCD     GPIOQ2_Handler             ; 102: IRQ86 GPIO Port Q2
                DCD     GPIOQ3_Handler             ; 103: IRQ87 GPIO Port Q3
                DCD     GPIOQ4_Handler             ; 104: IRQ88 GPIO Port Q4
                DCD     GPIOQ5_Handler             ; 105: IRQ89 GPIO Port Q5
                DCD     GPIOQ6_Handler             ; 106: IRQ90 GPIO Port Q6
                DCD     GPIOQ7_Handler             ; 107: IRQ91 GPIO Port Q7
                DCD     GPIOR_Handler              ; 108: IRQ92 GPIO Port R
                DCD     GPIOS_Handler              ; 109: IRQ93 GPIO Port S
                DCD     SHA0_Handler               ; 110: IRQ94 SHA/MD5
                DCD     AES0_Handler               ; 111: IRQ95 AES
                DCD     DES0_Handler               ; 112: IRQ96 DES
                DCD     LCD0_Handler               ; 113: IRQ97 LCD
                DCD     TIMER6A_Handler            ; 114: IRQ98 16/32-Bit Timer 6A
                DCD     TIMER6B_Handler            ; 115: IRQ99 16/32-Bit Timer 6B
                DCD     TIMER7A_Handler            ; 116: IRQ100 16/32-Bit Timer 7A
                DCD     TIMER7B_Handler            ; 117: IRQ101 16/32-Bit Timer 7B
                DCD     I2C6_Handler               ; 118: IRQ102 I2C 6
                DCD     I2C7_Handler               ; 119: IRQ103 I2C 7
                DCD     0                          ; 120: IRQ104 reservado
                DCD     ONEWIRE0_Handler           ; 121: IRQ105 1-Wire
                DCD     0                          ; 122: IRQ106 reservado
                DCD     0                          ; 123: IRQ107 reservado
                DCD     0                          ; 124: IRQ108 reservado
                DCD     I2C8_Handler               ; 125: IRQ109 I2C 8
                DCD     I2C9_Handler               ; 126: IRQ110 I2C 9
                DCD     GPIOT_Handler              ; 127: IRQ111 GPIO T
                DCD     0                          ; 128: IRQ112 reservado
__Vectors_End

__Vectors_Size  EQU     __Vectors_End - __Vectors

                AREA    |.text|, CODE, READONLY

; Reset: liga a FPU e salta para o __main
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

; excecoes: lacos infinitos (o programa pode redefinir)
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

; interrupcoes sem tratador caem aqui
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
                EXPORT  CAN0_Handler               [WEAK]
                EXPORT  CAN1_Handler               [WEAK]
                EXPORT  EMAC0_Handler              [WEAK]
                EXPORT  HIBERNATE_Handler          [WEAK]
                EXPORT  USB0_Handler               [WEAK]
                EXPORT  PWM0_3_Handler             [WEAK]
                EXPORT  UDMA_Handler               [WEAK]
                EXPORT  UDMAERR_Handler            [WEAK]
                EXPORT  ADC1SS0_Handler            [WEAK]
                EXPORT  ADC1SS1_Handler            [WEAK]
                EXPORT  ADC1SS2_Handler            [WEAK]
                EXPORT  ADC1SS3_Handler            [WEAK]
                EXPORT  EPI0_Handler               [WEAK]
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
                EXPORT  SYSEXC_Handler             [WEAK]
                EXPORT  I2C4_Handler               [WEAK]
                EXPORT  I2C5_Handler               [WEAK]
                EXPORT  GPIOM_Handler              [WEAK]
                EXPORT  GPION_Handler              [WEAK]
                EXPORT  TAMPER0_Handler            [WEAK]
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
                EXPORT  GPIOR_Handler              [WEAK]
                EXPORT  GPIOS_Handler              [WEAK]
                EXPORT  SHA0_Handler               [WEAK]
                EXPORT  AES0_Handler               [WEAK]
                EXPORT  DES0_Handler               [WEAK]
                EXPORT  LCD0_Handler               [WEAK]
                EXPORT  TIMER6A_Handler            [WEAK]
                EXPORT  TIMER6B_Handler            [WEAK]
                EXPORT  TIMER7A_Handler            [WEAK]
                EXPORT  TIMER7B_Handler            [WEAK]
                EXPORT  I2C6_Handler               [WEAK]
                EXPORT  I2C7_Handler               [WEAK]
                EXPORT  ONEWIRE0_Handler           [WEAK]
                EXPORT  I2C8_Handler               [WEAK]
                EXPORT  I2C9_Handler               [WEAK]
                EXPORT  GPIOT_Handler              [WEAK]

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
CAN0_Handler
CAN1_Handler
EMAC0_Handler
HIBERNATE_Handler
USB0_Handler
PWM0_3_Handler
UDMA_Handler
UDMAERR_Handler
ADC1SS0_Handler
ADC1SS1_Handler
ADC1SS2_Handler
ADC1SS3_Handler
EPI0_Handler
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
SYSEXC_Handler
I2C4_Handler
I2C5_Handler
GPIOM_Handler
GPION_Handler
TAMPER0_Handler
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
GPIOR_Handler
GPIOS_Handler
SHA0_Handler
AES0_Handler
DES0_Handler
LCD0_Handler
TIMER6A_Handler
TIMER6B_Handler
TIMER7A_Handler
TIMER7B_Handler
I2C6_Handler
I2C7_Handler
ONEWIRE0_Handler
I2C8_Handler
I2C9_Handler
GPIOT_Handler

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
                LDR     R0, =Heap_Mem
                LDR     R1, =(Stack_Mem + Stack_Size)
                LDR     R2, =(Heap_Mem + Heap_Size)
                LDR     R3, =Stack_Mem
                BX      LR

                ALIGN

                ENDIF

                END
