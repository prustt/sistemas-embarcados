@ startup_tm4c1294ncpdt.s
@ Startup do TM4C1294NCPDT (Cortex-M4F, EK-TM4C1294XL)
@ Sintaxe GNU as (arm-none-eabi-gcc), para o linker script tm4c1294ncpdt.ld
@ (simbolos _ldata, _data, _edata, _bss, _ebss).
@ Vetores tirados do TivaWare 2.2.0.295, inc/hw_ints.h (INT_*_TM4C129).

    .syntax unified
    .cpu cortex-m4
    .fpu softvfp
    .thumb

    .global g_pfnVectors
    .global Default_Handler

    .equ  Stack_Size, 0x200            @ 512 bytes, igual ao TivaWare

@ pilha em .bss, como no TivaWare
    .section .bss.stack,"aw",%nobits
    .p2align 3
Stack_Mem:
    .space Stack_Size
Stack_Top:

@ Reset: copia .data, zera .bss, liga a FPU e chama main
    .section .text.Reset_Handler,"ax",%progbits
    .global Reset_Handler
    .type  Reset_Handler, %function
Reset_Handler:
    ldr   r0, =_ldata                  @ valores iniciais na Flash
    ldr   r1, =_data
    ldr   r2, =_edata
CopiaData:
    cmp   r1, r2
    bhs   ZeraBss
    ldr   r3, [r0], #4
    str   r3, [r1], #4
    b     CopiaData

ZeraBss:
    ldr   r1, =_bss
    ldr   r2, =_ebss
    movs  r3, #0
LoopBss:
    cmp   r1, r2
    bhs   LigaFpu
    str   r3, [r1], #4
    b     LoopBss

LigaFpu:
    ldr   r0, =0xE000ED88              @ CPACR
    ldr   r1, [r0]
    orr   r1, r1, #0x00F00000          @ CP10 e CP11 com acesso total
    str   r1, [r0]
    dsb
    isb

    bl    main
Trava:
    b     Trava
    .size Reset_Handler, .-Reset_Handler

@ interrupcao sem tratador: fica parado aqui
    .section .text.Default_Handler,"ax",%progbits
    .type  Default_Handler, %function
Default_Handler:
    b     Default_Handler
    .size Default_Handler, .-Default_Handler

@ tabela de vetores (endereco 0x00000000)
    .section .isr_vector,"a",%progbits
    .type  g_pfnVectors, %object
g_pfnVectors:
    .word Stack_Top                @ 0: topo da pilha
    .word Reset_Handler            @ 1: Reset
    .word NMI_Handler              @ 2: NMI
    .word HardFault_Handler        @ 3: Hard Fault
    .word MemManage_Handler        @ 4: MPU Fault
    .word BusFault_Handler         @ 5: Bus Fault
    .word UsageFault_Handler       @ 6: Usage Fault
    .word 0                        @ 7: reservado
    .word 0                        @ 8: reservado
    .word 0                        @ 9: reservado
    .word 0                        @ 10: reservado
    .word SVC_Handler              @ 11: SVCall
    .word DebugMon_Handler         @ 12: Debug Monitor
    .word 0                        @ 13: reservado
    .word PendSV_Handler           @ 14: PendSV
    .word SysTick_Handler          @ 15: SysTick

@ interrupcoes dos perifericos (IRQn = posicao - 16)
    .word GPIOA_Handler            @ 16: IRQ0 GPIO Port A
    .word GPIOB_Handler            @ 17: IRQ1 GPIO Port B
    .word GPIOC_Handler            @ 18: IRQ2 GPIO Port C
    .word GPIOD_Handler            @ 19: IRQ3 GPIO Port D
    .word GPIOE_Handler            @ 20: IRQ4 GPIO Port E
    .word UART0_Handler            @ 21: IRQ5 UART0
    .word UART1_Handler            @ 22: IRQ6 UART1
    .word SSI0_Handler             @ 23: IRQ7 SSI0
    .word I2C0_Handler             @ 24: IRQ8 I2C0
    .word PWM0_FAULT_Handler       @ 25: IRQ9 PWM Fault
    .word PWM0_0_Handler           @ 26: IRQ10 PWM Generator 0
    .word PWM0_1_Handler           @ 27: IRQ11 PWM Generator 1
    .word PWM0_2_Handler           @ 28: IRQ12 PWM Generator 2
    .word QEI0_Handler             @ 29: IRQ13 QEI0
    .word ADC0SS0_Handler          @ 30: IRQ14 ADC0 Sequence 0
    .word ADC0SS1_Handler          @ 31: IRQ15 ADC0 Sequence 1
    .word ADC0SS2_Handler          @ 32: IRQ16 ADC0 Sequence 2
    .word ADC0SS3_Handler          @ 33: IRQ17 ADC0 Sequence 3
    .word WATCHDOG_Handler         @ 34: IRQ18 Watchdog Timers 0 and 1
    .word TIMER0A_Handler          @ 35: IRQ19 16/32-Bit Timer 0A
    .word TIMER0B_Handler          @ 36: IRQ20 16/32-Bit Timer 0B
    .word TIMER1A_Handler          @ 37: IRQ21 16/32-Bit Timer 1A
    .word TIMER1B_Handler          @ 38: IRQ22 16/32-Bit Timer 1B
    .word TIMER2A_Handler          @ 39: IRQ23 16/32-Bit Timer 2A
    .word TIMER2B_Handler          @ 40: IRQ24 16/32-Bit Timer 2B
    .word COMP0_Handler            @ 41: IRQ25 Analog Comparator 0
    .word COMP1_Handler            @ 42: IRQ26 Analog Comparator 1
    .word COMP2_Handler            @ 43: IRQ27 Analog Comparator 2
    .word SYSCTL_Handler           @ 44: IRQ28 System Control
    .word FLASH_Handler            @ 45: IRQ29 Flash Memory Control
    .word GPIOF_Handler            @ 46: IRQ30 GPIO Port F
    .word GPIOG_Handler            @ 47: IRQ31 GPIO Port G
    .word GPIOH_Handler            @ 48: IRQ32 GPIO Port H
    .word UART2_Handler            @ 49: IRQ33 UART2
    .word SSI1_Handler             @ 50: IRQ34 SSI1
    .word TIMER3A_Handler          @ 51: IRQ35 16/32-Bit Timer 3A
    .word TIMER3B_Handler          @ 52: IRQ36 16/32-Bit Timer 3B
    .word I2C1_Handler             @ 53: IRQ37 I2C1
    .word CAN0_Handler             @ 54: IRQ38 CAN 0
    .word CAN1_Handler             @ 55: IRQ39 CAN1
    .word EMAC0_Handler            @ 56: IRQ40 Ethernet MAC
    .word HIBERNATE_Handler        @ 57: IRQ41 HIB
    .word USB0_Handler             @ 58: IRQ42 USB MAC
    .word PWM0_3_Handler           @ 59: IRQ43 PWM Generator 3
    .word UDMA_Handler             @ 60: IRQ44 uDMA 0 Software
    .word UDMAERR_Handler          @ 61: IRQ45 uDMA 0 Error
    .word ADC1SS0_Handler          @ 62: IRQ46 ADC1 Sequence 0
    .word ADC1SS1_Handler          @ 63: IRQ47 ADC1 Sequence 1
    .word ADC1SS2_Handler          @ 64: IRQ48 ADC1 Sequence 2
    .word ADC1SS3_Handler          @ 65: IRQ49 ADC1 Sequence 3
    .word EPI0_Handler             @ 66: IRQ50 EPI 0
    .word GPIOJ_Handler            @ 67: IRQ51 GPIO Port J
    .word GPIOK_Handler            @ 68: IRQ52 GPIO Port K
    .word GPIOL_Handler            @ 69: IRQ53 GPIO Port L
    .word SSI2_Handler             @ 70: IRQ54 SSI 2
    .word SSI3_Handler             @ 71: IRQ55 SSI 3
    .word UART3_Handler            @ 72: IRQ56 UART 3
    .word UART4_Handler            @ 73: IRQ57 UART 4
    .word UART5_Handler            @ 74: IRQ58 UART 5
    .word UART6_Handler            @ 75: IRQ59 UART 6
    .word UART7_Handler            @ 76: IRQ60 UART 7
    .word I2C2_Handler             @ 77: IRQ61 I2C 2
    .word I2C3_Handler             @ 78: IRQ62 I2C 3
    .word TIMER4A_Handler          @ 79: IRQ63 Timer 4A
    .word TIMER4B_Handler          @ 80: IRQ64 Timer 4B
    .word TIMER5A_Handler          @ 81: IRQ65 Timer 5A
    .word TIMER5B_Handler          @ 82: IRQ66 Timer 5B
    .word SYSEXC_Handler           @ 83: IRQ67 Floating-Point Exception
    .word 0                        @ 84: IRQ68 reservado
    .word 0                        @ 85: IRQ69 reservado
    .word I2C4_Handler             @ 86: IRQ70 I2C 4
    .word I2C5_Handler             @ 87: IRQ71 I2C 5
    .word GPIOM_Handler            @ 88: IRQ72 GPIO Port M
    .word GPION_Handler            @ 89: IRQ73 GPIO Port N
    .word 0                        @ 90: IRQ74 reservado
    .word TAMPER0_Handler          @ 91: IRQ75 Tamper
    .word GPIOP0_Handler           @ 92: IRQ76 GPIO Port P (Summary or P0)
    .word GPIOP1_Handler           @ 93: IRQ77 GPIO Port P1
    .word GPIOP2_Handler           @ 94: IRQ78 GPIO Port P2
    .word GPIOP3_Handler           @ 95: IRQ79 GPIO Port P3
    .word GPIOP4_Handler           @ 96: IRQ80 GPIO Port P4
    .word GPIOP5_Handler           @ 97: IRQ81 GPIO Port P5
    .word GPIOP6_Handler           @ 98: IRQ82 GPIO Port P6
    .word GPIOP7_Handler           @ 99: IRQ83 GPIO Port P7
    .word GPIOQ0_Handler           @ 100: IRQ84 GPIO Port Q (Summary or Q0)
    .word GPIOQ1_Handler           @ 101: IRQ85 GPIO Port Q1
    .word GPIOQ2_Handler           @ 102: IRQ86 GPIO Port Q2
    .word GPIOQ3_Handler           @ 103: IRQ87 GPIO Port Q3
    .word GPIOQ4_Handler           @ 104: IRQ88 GPIO Port Q4
    .word GPIOQ5_Handler           @ 105: IRQ89 GPIO Port Q5
    .word GPIOQ6_Handler           @ 106: IRQ90 GPIO Port Q6
    .word GPIOQ7_Handler           @ 107: IRQ91 GPIO Port Q7
    .word GPIOR_Handler            @ 108: IRQ92 GPIO Port R
    .word GPIOS_Handler            @ 109: IRQ93 GPIO Port S
    .word SHA0_Handler             @ 110: IRQ94 SHA/MD5
    .word AES0_Handler             @ 111: IRQ95 AES
    .word DES0_Handler             @ 112: IRQ96 DES
    .word LCD0_Handler             @ 113: IRQ97 LCD
    .word TIMER6A_Handler          @ 114: IRQ98 16/32-Bit Timer 6A
    .word TIMER6B_Handler          @ 115: IRQ99 16/32-Bit Timer 6B
    .word TIMER7A_Handler          @ 116: IRQ100 16/32-Bit Timer 7A
    .word TIMER7B_Handler          @ 117: IRQ101 16/32-Bit Timer 7B
    .word I2C6_Handler             @ 118: IRQ102 I2C 6
    .word I2C7_Handler             @ 119: IRQ103 I2C 7
    .word 0                        @ 120: IRQ104 reservado
    .word ONEWIRE0_Handler         @ 121: IRQ105 1-Wire
    .word 0                        @ 122: IRQ106 reservado
    .word 0                        @ 123: IRQ107 reservado
    .word 0                        @ 124: IRQ108 reservado
    .word I2C8_Handler             @ 125: IRQ109 I2C 8
    .word I2C9_Handler             @ 126: IRQ110 I2C 9
    .word GPIOT_Handler            @ 127: IRQ111 GPIO T
    .word 0                        @ 128: IRQ112 reservado
    .size g_pfnVectors, .-g_pfnVectors

@ tratadores fracos: se o programa definir um com o mesmo nome, ele substitui
    .weak      NMI_Handler
    .thumb_set NMI_Handler, Default_Handler
    .weak      HardFault_Handler
    .thumb_set HardFault_Handler, Default_Handler
    .weak      MemManage_Handler
    .thumb_set MemManage_Handler, Default_Handler
    .weak      BusFault_Handler
    .thumb_set BusFault_Handler, Default_Handler
    .weak      UsageFault_Handler
    .thumb_set UsageFault_Handler, Default_Handler
    .weak      SVC_Handler
    .thumb_set SVC_Handler, Default_Handler
    .weak      DebugMon_Handler
    .thumb_set DebugMon_Handler, Default_Handler
    .weak      PendSV_Handler
    .thumb_set PendSV_Handler, Default_Handler
    .weak      SysTick_Handler
    .thumb_set SysTick_Handler, Default_Handler
    .weak      GPIOA_Handler
    .thumb_set GPIOA_Handler, Default_Handler
    .weak      GPIOB_Handler
    .thumb_set GPIOB_Handler, Default_Handler
    .weak      GPIOC_Handler
    .thumb_set GPIOC_Handler, Default_Handler
    .weak      GPIOD_Handler
    .thumb_set GPIOD_Handler, Default_Handler
    .weak      GPIOE_Handler
    .thumb_set GPIOE_Handler, Default_Handler
    .weak      UART0_Handler
    .thumb_set UART0_Handler, Default_Handler
    .weak      UART1_Handler
    .thumb_set UART1_Handler, Default_Handler
    .weak      SSI0_Handler
    .thumb_set SSI0_Handler, Default_Handler
    .weak      I2C0_Handler
    .thumb_set I2C0_Handler, Default_Handler
    .weak      PWM0_FAULT_Handler
    .thumb_set PWM0_FAULT_Handler, Default_Handler
    .weak      PWM0_0_Handler
    .thumb_set PWM0_0_Handler, Default_Handler
    .weak      PWM0_1_Handler
    .thumb_set PWM0_1_Handler, Default_Handler
    .weak      PWM0_2_Handler
    .thumb_set PWM0_2_Handler, Default_Handler
    .weak      QEI0_Handler
    .thumb_set QEI0_Handler, Default_Handler
    .weak      ADC0SS0_Handler
    .thumb_set ADC0SS0_Handler, Default_Handler
    .weak      ADC0SS1_Handler
    .thumb_set ADC0SS1_Handler, Default_Handler
    .weak      ADC0SS2_Handler
    .thumb_set ADC0SS2_Handler, Default_Handler
    .weak      ADC0SS3_Handler
    .thumb_set ADC0SS3_Handler, Default_Handler
    .weak      WATCHDOG_Handler
    .thumb_set WATCHDOG_Handler, Default_Handler
    .weak      TIMER0A_Handler
    .thumb_set TIMER0A_Handler, Default_Handler
    .weak      TIMER0B_Handler
    .thumb_set TIMER0B_Handler, Default_Handler
    .weak      TIMER1A_Handler
    .thumb_set TIMER1A_Handler, Default_Handler
    .weak      TIMER1B_Handler
    .thumb_set TIMER1B_Handler, Default_Handler
    .weak      TIMER2A_Handler
    .thumb_set TIMER2A_Handler, Default_Handler
    .weak      TIMER2B_Handler
    .thumb_set TIMER2B_Handler, Default_Handler
    .weak      COMP0_Handler
    .thumb_set COMP0_Handler, Default_Handler
    .weak      COMP1_Handler
    .thumb_set COMP1_Handler, Default_Handler
    .weak      COMP2_Handler
    .thumb_set COMP2_Handler, Default_Handler
    .weak      SYSCTL_Handler
    .thumb_set SYSCTL_Handler, Default_Handler
    .weak      FLASH_Handler
    .thumb_set FLASH_Handler, Default_Handler
    .weak      GPIOF_Handler
    .thumb_set GPIOF_Handler, Default_Handler
    .weak      GPIOG_Handler
    .thumb_set GPIOG_Handler, Default_Handler
    .weak      GPIOH_Handler
    .thumb_set GPIOH_Handler, Default_Handler
    .weak      UART2_Handler
    .thumb_set UART2_Handler, Default_Handler
    .weak      SSI1_Handler
    .thumb_set SSI1_Handler, Default_Handler
    .weak      TIMER3A_Handler
    .thumb_set TIMER3A_Handler, Default_Handler
    .weak      TIMER3B_Handler
    .thumb_set TIMER3B_Handler, Default_Handler
    .weak      I2C1_Handler
    .thumb_set I2C1_Handler, Default_Handler
    .weak      CAN0_Handler
    .thumb_set CAN0_Handler, Default_Handler
    .weak      CAN1_Handler
    .thumb_set CAN1_Handler, Default_Handler
    .weak      EMAC0_Handler
    .thumb_set EMAC0_Handler, Default_Handler
    .weak      HIBERNATE_Handler
    .thumb_set HIBERNATE_Handler, Default_Handler
    .weak      USB0_Handler
    .thumb_set USB0_Handler, Default_Handler
    .weak      PWM0_3_Handler
    .thumb_set PWM0_3_Handler, Default_Handler
    .weak      UDMA_Handler
    .thumb_set UDMA_Handler, Default_Handler
    .weak      UDMAERR_Handler
    .thumb_set UDMAERR_Handler, Default_Handler
    .weak      ADC1SS0_Handler
    .thumb_set ADC1SS0_Handler, Default_Handler
    .weak      ADC1SS1_Handler
    .thumb_set ADC1SS1_Handler, Default_Handler
    .weak      ADC1SS2_Handler
    .thumb_set ADC1SS2_Handler, Default_Handler
    .weak      ADC1SS3_Handler
    .thumb_set ADC1SS3_Handler, Default_Handler
    .weak      EPI0_Handler
    .thumb_set EPI0_Handler, Default_Handler
    .weak      GPIOJ_Handler
    .thumb_set GPIOJ_Handler, Default_Handler
    .weak      GPIOK_Handler
    .thumb_set GPIOK_Handler, Default_Handler
    .weak      GPIOL_Handler
    .thumb_set GPIOL_Handler, Default_Handler
    .weak      SSI2_Handler
    .thumb_set SSI2_Handler, Default_Handler
    .weak      SSI3_Handler
    .thumb_set SSI3_Handler, Default_Handler
    .weak      UART3_Handler
    .thumb_set UART3_Handler, Default_Handler
    .weak      UART4_Handler
    .thumb_set UART4_Handler, Default_Handler
    .weak      UART5_Handler
    .thumb_set UART5_Handler, Default_Handler
    .weak      UART6_Handler
    .thumb_set UART6_Handler, Default_Handler
    .weak      UART7_Handler
    .thumb_set UART7_Handler, Default_Handler
    .weak      I2C2_Handler
    .thumb_set I2C2_Handler, Default_Handler
    .weak      I2C3_Handler
    .thumb_set I2C3_Handler, Default_Handler
    .weak      TIMER4A_Handler
    .thumb_set TIMER4A_Handler, Default_Handler
    .weak      TIMER4B_Handler
    .thumb_set TIMER4B_Handler, Default_Handler
    .weak      TIMER5A_Handler
    .thumb_set TIMER5A_Handler, Default_Handler
    .weak      TIMER5B_Handler
    .thumb_set TIMER5B_Handler, Default_Handler
    .weak      SYSEXC_Handler
    .thumb_set SYSEXC_Handler, Default_Handler
    .weak      I2C4_Handler
    .thumb_set I2C4_Handler, Default_Handler
    .weak      I2C5_Handler
    .thumb_set I2C5_Handler, Default_Handler
    .weak      GPIOM_Handler
    .thumb_set GPIOM_Handler, Default_Handler
    .weak      GPION_Handler
    .thumb_set GPION_Handler, Default_Handler
    .weak      TAMPER0_Handler
    .thumb_set TAMPER0_Handler, Default_Handler
    .weak      GPIOP0_Handler
    .thumb_set GPIOP0_Handler, Default_Handler
    .weak      GPIOP1_Handler
    .thumb_set GPIOP1_Handler, Default_Handler
    .weak      GPIOP2_Handler
    .thumb_set GPIOP2_Handler, Default_Handler
    .weak      GPIOP3_Handler
    .thumb_set GPIOP3_Handler, Default_Handler
    .weak      GPIOP4_Handler
    .thumb_set GPIOP4_Handler, Default_Handler
    .weak      GPIOP5_Handler
    .thumb_set GPIOP5_Handler, Default_Handler
    .weak      GPIOP6_Handler
    .thumb_set GPIOP6_Handler, Default_Handler
    .weak      GPIOP7_Handler
    .thumb_set GPIOP7_Handler, Default_Handler
    .weak      GPIOQ0_Handler
    .thumb_set GPIOQ0_Handler, Default_Handler
    .weak      GPIOQ1_Handler
    .thumb_set GPIOQ1_Handler, Default_Handler
    .weak      GPIOQ2_Handler
    .thumb_set GPIOQ2_Handler, Default_Handler
    .weak      GPIOQ3_Handler
    .thumb_set GPIOQ3_Handler, Default_Handler
    .weak      GPIOQ4_Handler
    .thumb_set GPIOQ4_Handler, Default_Handler
    .weak      GPIOQ5_Handler
    .thumb_set GPIOQ5_Handler, Default_Handler
    .weak      GPIOQ6_Handler
    .thumb_set GPIOQ6_Handler, Default_Handler
    .weak      GPIOQ7_Handler
    .thumb_set GPIOQ7_Handler, Default_Handler
    .weak      GPIOR_Handler
    .thumb_set GPIOR_Handler, Default_Handler
    .weak      GPIOS_Handler
    .thumb_set GPIOS_Handler, Default_Handler
    .weak      SHA0_Handler
    .thumb_set SHA0_Handler, Default_Handler
    .weak      AES0_Handler
    .thumb_set AES0_Handler, Default_Handler
    .weak      DES0_Handler
    .thumb_set DES0_Handler, Default_Handler
    .weak      LCD0_Handler
    .thumb_set LCD0_Handler, Default_Handler
    .weak      TIMER6A_Handler
    .thumb_set TIMER6A_Handler, Default_Handler
    .weak      TIMER6B_Handler
    .thumb_set TIMER6B_Handler, Default_Handler
    .weak      TIMER7A_Handler
    .thumb_set TIMER7A_Handler, Default_Handler
    .weak      TIMER7B_Handler
    .thumb_set TIMER7B_Handler, Default_Handler
    .weak      I2C6_Handler
    .thumb_set I2C6_Handler, Default_Handler
    .weak      I2C7_Handler
    .thumb_set I2C7_Handler, Default_Handler
    .weak      ONEWIRE0_Handler
    .thumb_set ONEWIRE0_Handler, Default_Handler
    .weak      I2C8_Handler
    .thumb_set I2C8_Handler, Default_Handler
    .weak      I2C9_Handler
    .thumb_set I2C9_Handler, Default_Handler
    .weak      GPIOT_Handler
    .thumb_set GPIOT_Handler, Default_Handler
