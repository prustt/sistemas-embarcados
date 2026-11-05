/*
 * startup_tm4c123gh6pm.s
 * Startup do TM4C123GH6PM (Cortex-M4F, TI Tiva C) - sintaxe GNU as (arm-none-eabi-gcc).
 * Vetores da classe TM4C123 tirados do TivaWare 2.2.0.295 (inc/hw_ints.h);
 * nem todos os perifericos existem no GH6PM.
 * Simbolos do linker iguais aos do TivaWare: _ldata, _data, _edata, _bss, _ebss.
 */

  .syntax unified
  .cpu cortex-m4
  .fpu softvfp
  .thumb

  .global g_pfnVectors
  .global Default_Handler

  .equ Stack_Size, 0x00000200

/* pilha em .bss, como no TivaWare */
  .section .bss.stack,"aw",%nobits
  .align 3
Stack_Mem:
  .space Stack_Size
Stack_Top:

/* tabela de vetores (endereco 0x00000000) */
  .section .isr_vector,"a",%progbits
  .type g_pfnVectors, %object
g_pfnVectors:
  .word  Stack_Top                  @ 0: topo da pilha
  .word  Reset_Handler              @ 1: Reset
  .word  NMI_Handler                @ 2: NMI
  .word  HardFault_Handler          @ 3: Hard Fault
  .word  MemManage_Handler          @ 4: MPU Fault
  .word  BusFault_Handler           @ 5: Bus Fault
  .word  UsageFault_Handler         @ 6: Usage Fault
  .word  0                          @ 7: reservado
  .word  0                          @ 8: reservado
  .word  0                          @ 9: reservado
  .word  0                          @ 10: reservado
  .word  SVC_Handler                @ 11: SVCall
  .word  DebugMon_Handler           @ 12: Debug Monitor
  .word  0                          @ 13: reservado
  .word  PendSV_Handler             @ 14: PendSV
  .word  SysTick_Handler            @ 15: SysTick
  .word  GPIOA_Handler              @ 16: IRQ0 GPIO Port A
  .word  GPIOB_Handler              @ 17: IRQ1 GPIO Port B
  .word  GPIOC_Handler              @ 18: IRQ2 GPIO Port C
  .word  GPIOD_Handler              @ 19: IRQ3 GPIO Port D
  .word  GPIOE_Handler              @ 20: IRQ4 GPIO Port E
  .word  UART0_Handler              @ 21: IRQ5 UART0
  .word  UART1_Handler              @ 22: IRQ6 UART1
  .word  SSI0_Handler               @ 23: IRQ7 SSI0
  .word  I2C0_Handler               @ 24: IRQ8 I2C0
  .word  PWM0_FAULT_Handler         @ 25: IRQ9 PWM0 Fault
  .word  PWM0_0_Handler             @ 26: IRQ10 PWM0 Generator 0
  .word  PWM0_1_Handler             @ 27: IRQ11 PWM0 Generator 1
  .word  PWM0_2_Handler             @ 28: IRQ12 PWM0 Generator 2
  .word  QEI0_Handler               @ 29: IRQ13 QEI0
  .word  ADC0SS0_Handler            @ 30: IRQ14 ADC0 Sequence 0
  .word  ADC0SS1_Handler            @ 31: IRQ15 ADC0 Sequence 1
  .word  ADC0SS2_Handler            @ 32: IRQ16 ADC0 Sequence 2
  .word  ADC0SS3_Handler            @ 33: IRQ17 ADC0 Sequence 3
  .word  WATCHDOG_Handler           @ 34: IRQ18 Watchdog Timers 0 and 1
  .word  TIMER0A_Handler            @ 35: IRQ19 16/32-Bit Timer 0A
  .word  TIMER0B_Handler            @ 36: IRQ20 16/32-Bit Timer 0B
  .word  TIMER1A_Handler            @ 37: IRQ21 16/32-Bit Timer 1A
  .word  TIMER1B_Handler            @ 38: IRQ22 16/32-Bit Timer 1B
  .word  TIMER2A_Handler            @ 39: IRQ23 16/32-Bit Timer 2A
  .word  TIMER2B_Handler            @ 40: IRQ24 16/32-Bit Timer 2B
  .word  COMP0_Handler              @ 41: IRQ25 Analog Comparator 0
  .word  COMP1_Handler              @ 42: IRQ26 Analog Comparator 1
  .word  COMP2_Handler              @ 43: IRQ27 Analog Comparator 2
  .word  SYSCTL_Handler             @ 44: IRQ28 System Control
  .word  FLASH_Handler              @ 45: IRQ29 Flash Memory Control and EEPROM
  .word  GPIOF_Handler              @ 46: IRQ30 GPIO Port F
  .word  GPIOG_Handler              @ 47: IRQ31 GPIO Port G
  .word  GPIOH_Handler              @ 48: IRQ32 GPIO Port H
  .word  UART2_Handler              @ 49: IRQ33 UART2
  .word  SSI1_Handler               @ 50: IRQ34 SSI1
  .word  TIMER3A_Handler            @ 51: IRQ35 16/32-Bit Timer 3A
  .word  TIMER3B_Handler            @ 52: IRQ36 16/32-Bit Timer 3B
  .word  I2C1_Handler               @ 53: IRQ37 I2C1
  .word  QEI1_Handler               @ 54: IRQ38 QEI1
  .word  CAN0_Handler               @ 55: IRQ39 CAN0
  .word  CAN1_Handler               @ 56: IRQ40 CAN1
  .word  0                          @ 57: IRQ41 reservado
  .word  0                          @ 58: IRQ42 reservado
  .word  HIBERNATE_Handler          @ 59: IRQ43 Hibernation Module
  .word  USB0_Handler               @ 60: IRQ44 USB
  .word  PWM0_3_Handler             @ 61: IRQ45 PWM0 Generator 3
  .word  UDMA_Handler               @ 62: IRQ46 uDMA Software
  .word  UDMAERR_Handler            @ 63: IRQ47 uDMA Error
  .word  ADC1SS0_Handler            @ 64: IRQ48 ADC1 Sequence 0
  .word  ADC1SS1_Handler            @ 65: IRQ49 ADC1 Sequence 1
  .word  ADC1SS2_Handler            @ 66: IRQ50 ADC1 Sequence 2
  .word  ADC1SS3_Handler            @ 67: IRQ51 ADC1 Sequence 3
  .word  0                          @ 68: IRQ52 reservado
  .word  0                          @ 69: IRQ53 reservado
  .word  GPIOJ_Handler              @ 70: IRQ54 GPIO Port J
  .word  GPIOK_Handler              @ 71: IRQ55 GPIO Port K
  .word  GPIOL_Handler              @ 72: IRQ56 GPIO Port L
  .word  SSI2_Handler               @ 73: IRQ57 SSI2
  .word  SSI3_Handler               @ 74: IRQ58 SSI3
  .word  UART3_Handler              @ 75: IRQ59 UART3
  .word  UART4_Handler              @ 76: IRQ60 UART4
  .word  UART5_Handler              @ 77: IRQ61 UART5
  .word  UART6_Handler              @ 78: IRQ62 UART6
  .word  UART7_Handler              @ 79: IRQ63 UART7
  .word  0                          @ 80: IRQ64 reservado
  .word  0                          @ 81: IRQ65 reservado
  .word  0                          @ 82: IRQ66 reservado
  .word  0                          @ 83: IRQ67 reservado
  .word  I2C2_Handler               @ 84: IRQ68 I2C2
  .word  I2C3_Handler               @ 85: IRQ69 I2C3
  .word  TIMER4A_Handler            @ 86: IRQ70 16/32-Bit Timer 4A
  .word  TIMER4B_Handler            @ 87: IRQ71 16/32-Bit Timer 4B
  .word  0                          @ 88: IRQ72 reservado
  .word  0                          @ 89: IRQ73 reservado
  .word  0                          @ 90: IRQ74 reservado
  .word  0                          @ 91: IRQ75 reservado
  .word  0                          @ 92: IRQ76 reservado
  .word  0                          @ 93: IRQ77 reservado
  .word  0                          @ 94: IRQ78 reservado
  .word  0                          @ 95: IRQ79 reservado
  .word  0                          @ 96: IRQ80 reservado
  .word  0                          @ 97: IRQ81 reservado
  .word  0                          @ 98: IRQ82 reservado
  .word  0                          @ 99: IRQ83 reservado
  .word  0                          @ 100: IRQ84 reservado
  .word  0                          @ 101: IRQ85 reservado
  .word  0                          @ 102: IRQ86 reservado
  .word  0                          @ 103: IRQ87 reservado
  .word  0                          @ 104: IRQ88 reservado
  .word  0                          @ 105: IRQ89 reservado
  .word  0                          @ 106: IRQ90 reservado
  .word  0                          @ 107: IRQ91 reservado
  .word  TIMER5A_Handler            @ 108: IRQ92 16/32-Bit Timer 5A
  .word  TIMER5B_Handler            @ 109: IRQ93 16/32-Bit Timer 5B
  .word  WTIMER0A_Handler           @ 110: IRQ94 32/64-Bit Timer 0A
  .word  WTIMER0B_Handler           @ 111: IRQ95 32/64-Bit Timer 0B
  .word  WTIMER1A_Handler           @ 112: IRQ96 32/64-Bit Timer 1A
  .word  WTIMER1B_Handler           @ 113: IRQ97 32/64-Bit Timer 1B
  .word  WTIMER2A_Handler           @ 114: IRQ98 32/64-Bit Timer 2A
  .word  WTIMER2B_Handler           @ 115: IRQ99 32/64-Bit Timer 2B
  .word  WTIMER3A_Handler           @ 116: IRQ100 32/64-Bit Timer 3A
  .word  WTIMER3B_Handler           @ 117: IRQ101 32/64-Bit Timer 3B
  .word  WTIMER4A_Handler           @ 118: IRQ102 32/64-Bit Timer 4A
  .word  WTIMER4B_Handler           @ 119: IRQ103 32/64-Bit Timer 4B
  .word  WTIMER5A_Handler           @ 120: IRQ104 32/64-Bit Timer 5A
  .word  WTIMER5B_Handler           @ 121: IRQ105 32/64-Bit Timer 5B
  .word  SYSEXC_Handler             @ 122: IRQ106 System Exception (imprecise)
  .word  0                          @ 123: IRQ107 reservado
  .word  0                          @ 124: IRQ108 reservado
  .word  I2C4_Handler               @ 125: IRQ109 I2C4
  .word  I2C5_Handler               @ 126: IRQ110 I2C5
  .word  GPIOM_Handler              @ 127: IRQ111 GPIO Port M
  .word  GPION_Handler              @ 128: IRQ112 GPIO Port N
  .word  0                          @ 129: IRQ113 reservado
  .word  0                          @ 130: IRQ114 reservado
  .word  0                          @ 131: IRQ115 reservado
  .word  GPIOP0_Handler             @ 132: IRQ116 GPIO Port P (Summary or P0)
  .word  GPIOP1_Handler             @ 133: IRQ117 GPIO Port P1
  .word  GPIOP2_Handler             @ 134: IRQ118 GPIO Port P2
  .word  GPIOP3_Handler             @ 135: IRQ119 GPIO Port P3
  .word  GPIOP4_Handler             @ 136: IRQ120 GPIO Port P4
  .word  GPIOP5_Handler             @ 137: IRQ121 GPIO Port P5
  .word  GPIOP6_Handler             @ 138: IRQ122 GPIO Port P6
  .word  GPIOP7_Handler             @ 139: IRQ123 GPIO Port P7
  .word  GPIOQ0_Handler             @ 140: IRQ124 GPIO Port Q (Summary or Q0)
  .word  GPIOQ1_Handler             @ 141: IRQ125 GPIO Port Q1
  .word  GPIOQ2_Handler             @ 142: IRQ126 GPIO Port Q2
  .word  GPIOQ3_Handler             @ 143: IRQ127 GPIO Port Q3
  .word  GPIOQ4_Handler             @ 144: IRQ128 GPIO Port Q4
  .word  GPIOQ5_Handler             @ 145: IRQ129 GPIO Port Q5
  .word  GPIOQ6_Handler             @ 146: IRQ130 GPIO Port Q6
  .word  GPIOQ7_Handler             @ 147: IRQ131 GPIO Port Q7
  .word  0                          @ 148: IRQ132 reservado
  .word  0                          @ 149: IRQ133 reservado
  .word  PWM1_0_Handler             @ 150: IRQ134 PWM1 Generator 0
  .word  PWM1_1_Handler             @ 151: IRQ135 PWM1 Generator 1
  .word  PWM1_2_Handler             @ 152: IRQ136 PWM1 Generator 2
  .word  PWM1_3_Handler             @ 153: IRQ137 PWM1 Generator 3
  .word  PWM1_FAULT_Handler         @ 154: IRQ138 PWM1 Fault
  .size g_pfnVectors, .-g_pfnVectors

  .section .text.Reset_Handler,"ax",%progbits
  .weak Reset_Handler
  .type Reset_Handler, %function
Reset_Handler:
/* copia .data da Flash para a RAM */
  ldr   r0, =_ldata
  ldr   r1, =_data
  ldr   r2, =_edata
copia_data:
  cmp   r1, r2
  bhs   zera_bss
  ldr   r3, [r0], #4
  str   r3, [r1], #4
  b     copia_data

/* zera .bss */
zera_bss:
  ldr   r1, =_bss
  ldr   r2, =_ebss
  movs  r3, #0
loop_bss:
  cmp   r1, r2
  bhs   liga_fpu
  str   r3, [r1], #4
  b     loop_bss

/* liga a FPU: CPACR (0xE000ED88), CP10 e CP11 com acesso total */
liga_fpu:
  ldr   r0, =0xE000ED88
  ldr   r1, [r0]
  orr   r1, r1, #0x00F00000
  str   r1, [r0]
  dsb
  isb

  bl    main
fim:
  b     fim
  .size Reset_Handler, .-Reset_Handler

/* interrupcao sem handler proprio cai aqui */
  .section .text.Default_Handler,"ax",%progbits
  .type Default_Handler, %function
Default_Handler:
  b     Default_Handler
  .size Default_Handler, .-Default_Handler

/* handlers fracos: definir uma funcao com o mesmo nome substitui o Default_Handler */
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
  .weak      QEI1_Handler
  .thumb_set QEI1_Handler, Default_Handler
  .weak      CAN0_Handler
  .thumb_set CAN0_Handler, Default_Handler
  .weak      CAN1_Handler
  .thumb_set CAN1_Handler, Default_Handler
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
  .weak      WTIMER0A_Handler
  .thumb_set WTIMER0A_Handler, Default_Handler
  .weak      WTIMER0B_Handler
  .thumb_set WTIMER0B_Handler, Default_Handler
  .weak      WTIMER1A_Handler
  .thumb_set WTIMER1A_Handler, Default_Handler
  .weak      WTIMER1B_Handler
  .thumb_set WTIMER1B_Handler, Default_Handler
  .weak      WTIMER2A_Handler
  .thumb_set WTIMER2A_Handler, Default_Handler
  .weak      WTIMER2B_Handler
  .thumb_set WTIMER2B_Handler, Default_Handler
  .weak      WTIMER3A_Handler
  .thumb_set WTIMER3A_Handler, Default_Handler
  .weak      WTIMER3B_Handler
  .thumb_set WTIMER3B_Handler, Default_Handler
  .weak      WTIMER4A_Handler
  .thumb_set WTIMER4A_Handler, Default_Handler
  .weak      WTIMER4B_Handler
  .thumb_set WTIMER4B_Handler, Default_Handler
  .weak      WTIMER5A_Handler
  .thumb_set WTIMER5A_Handler, Default_Handler
  .weak      WTIMER5B_Handler
  .thumb_set WTIMER5B_Handler, Default_Handler
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
  .weak      PWM1_0_Handler
  .thumb_set PWM1_0_Handler, Default_Handler
  .weak      PWM1_1_Handler
  .thumb_set PWM1_1_Handler, Default_Handler
  .weak      PWM1_2_Handler
  .thumb_set PWM1_2_Handler, Default_Handler
  .weak      PWM1_3_Handler
  .thumb_set PWM1_3_Handler, Default_Handler
  .weak      PWM1_FAULT_Handler
  .thumb_set PWM1_FAULT_Handler, Default_Handler
