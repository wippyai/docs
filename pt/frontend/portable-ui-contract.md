---
title: "Contrato de UI Portável"
description: "Regras normativas para PrimeVue, Tailwind, tokens, controles customizados, acessibilidade e portabilidade."
---

# Contrato de UI Portável

Os IDs a seguir são os donos canônicos de suas regras.

## Portabilidade

### FE-PORT-001: Portável é o padrão

Um módulo conforme funciona com outro tema de facade conforme, sem edições no módulo e sem classes de facade privadas do projeto.

### FE-STYLE-001: Sem dependência privada de facade

Módulos portáveis não podem exigir classes ou seletores arbitrários definidos por apenas uma facade. Regras de tema `.p-*` compartilhadas do PrimeVue não são classes privadas. Estilização não-PrimeVue exigida por um módulo pertence a esse módulo, mas deve ser minimizada pela conformidade com componentes e semânticas compartilhados.

Quando *vários* dos seus próprios módulos precisam da mesma estilização não-PrimeVue, ela não pertence nem à facade nem a cada módulo: veja [A Camada de Design](./design-layer.md).

## Componentes e affordance

### FE-UI-001: Use PrimeVue quando ele atende ao controle

Se o PrimeVue fornece a semântica, a interação e a affordance pretendida, o módulo deve usá-lo.

### FE-UI-002: Formato de dados não é affordance

A capacidade de representar os mesmos valores não torna dois controles equivalentes. Um `SelectButton` não é automaticamente um substituto para um toggle deslizante de três posições quando a affordance pretendida é, visual e comportamentalmente, um toggle.

### FE-UI-003: Mesma semântica e affordance significa mesma aparência

Controles equivalentes devem compartilhar tamanhos, espaçamento, cores, tipografia, bordas, sombras, foco, hover, desabilitado, inválido e comportamento de movimento. Um composto customizado nomeia seu irmão visual no PrimeVue e herda toda propriedade de runtime compartilhada aplicável.

### FE-UI-004: A omissão do PrimeVue é restrita

O PrimeVue pode ser omitido apenas quando o módulo não renderiza nada que seja física ou semanticamente semelhante ao PrimeVue. Um componente apenas de gráfico se qualifica; um gráfico com um botão ou campo de formulário não.

### FE-UI-005: Nunca invente APIs de componentes

Uma prop ou comportamento não documentado não é um atalho. O `ToggleSwitch` do PrimeVue não se torna um controle de três posições por inventar uma nova prop de posições. Quando nenhum componente ou composição do PrimeVue fornece a affordance necessária, use o processo revisado de irmão customizado.

## Tailwind e tokens

### FE-TW-001: O Tailwind do Wippy é suportado

O preset compartilhado do Wippy é um contrato suportado de tempo de build. Módulos podem usar seus utilitários documentados e estendê-lo para layout de domínio, breakpoints específicos da aplicação, decoração e visualização inédita.

### FE-TW-002: Valores compilados não são tokens de runtime

Utilitários como `px-3`, `rounded-md` e `duration-200` normalmente compilam para constantes. Eles fornecem uma linha de base consistente, mas não mudam quando uma facade troca as variáveis de tema de runtime.

### FE-TW-003: A aparência de irmãos compartilhados acompanha a semântica de runtime

Quando uma propriedade de aparência deve acompanhar um irmão PrimeVue entre temas, use um utilitário semântico documentado e apoiado em runtime, ou um token público direto. Um utilitário fixo só é permitido quando a propriedade é explicitamente classificada como `platform-invariant`.

### FE-TW-004: Mapeamentos protegidos mantêm seu significado

Módulos podem estender o preset, mas não podem redefinir de forma incompatível as semânticas protegidas de primary, surface, severity, text, content, highlight ou de controles portáveis.

### FE-TOKEN-001: Todo token deve existir

Toda referência `--p-*` deve estar presente no manifesto gerado selecionado.

### FE-TOKEN-002: Nomes de token não são APIs adivinháveis

Nunca construa um token por analogia. Pesquise no [Catálogo de Tokens](./micro-frontends/token-catalogue.md) ou no manifesto do pacote selecionado.

## Acessibilidade

### FE-A11Y-001: Customizado não é dispensa de acessibilidade

Uma exceção de controle customizado deve preservar HTML válido, interação por teclado, foco, nome acessível, estado e comportamento de desabilitado. Elementos interativos não devem ser aninhados.
