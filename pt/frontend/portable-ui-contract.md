---
title: "Contrato de UI portável"
description: "Regras normativas para PrimeVue, Tailwind, tokens, controles personalizados, acessibilidade e portabilidade."
---

# Contrato de UI portável

Esta página é uma referência normativa de contrato. Seus IDs de regra definem requisitos de revisão e aceitação, não um tutorial de implementação.

Os IDs abaixo são os proprietários canônicos de suas regras.

## Portabilidade

### FE-PORT-001: Portável é o padrão

Um módulo compatível funciona com outro tema de facade compatível sem alterações no módulo e sem classes privadas da facade do projeto.

### FE-STYLE-001: Sem dependência privada da facade

Módulos portáveis não podem exigir classes ou seletores arbitrários definidos apenas por uma facade. Regras de tema `.p-*` compartilhadas do PrimeVue não são classes privadas. Estilo não PrimeVue exigido por um único módulo pertence a esse módulo, mas deve ser minimizado pela conformidade com componentes e semânticas compartilhados.

Quando *vários* módulos próprios precisam do mesmo estilo não PrimeVue, ele não pertence à facade nem a cada módulo: consulte [A camada de design](./design-layer.md).

## Componentes e affordance

### FE-UI-001: Use PrimeVue quando ele atende ao controle

Se PrimeVue oferece a semântica, interação e affordance pretendida, o módulo deve usá-lo.

### FE-UI-002: Formato dos dados não é affordance

A capacidade de representar os mesmos valores não torna dois controles equivalentes. Um `SelectButton` não substitui automaticamente um toggle deslizante de três posições quando a affordance pretendida é visual e comportamentalmente um toggle.

### FE-UI-003: Mesma semântica e affordance significam mesma aparência

Controles equivalentes devem compartilhar tamanhos, espaçamento, cores, tipografia, bordas, sombras, foco, hover, estados desativado e inválido e movimento. Uma composição personalizada nomeia seu equivalente visual PrimeVue e herda todas as propriedades compartilhadas aplicáveis da runtime.

### FE-UI-004: A omissão do PrimeVue é restrita

PrimeVue pode ser omitido apenas quando o módulo não renderiza nada física ou semanticamente semelhante ao PrimeVue. Um componente apenas de gráfico se qualifica; um gráfico com botão ou campo de formulário, não.

### FE-UI-005: Nunca invente APIs de componentes

Uma prop ou um comportamento não documentado não é um atalho. O `ToggleSwitch` do PrimeVue não se torna um controle de três posições pela invenção de uma prop de posições. Quando nenhum componente ou composição PrimeVue oferece a affordance necessária, use o processo revisado de equivalente personalizado.

## Tailwind e tokens

### FE-TW-001: O Tailwind do Wippy é compatível

O preset compartilhado do Wippy é um contrato de build compatível. Módulos podem usar suas utilities documentadas e estendê-lo para layout de domínio, breakpoints específicos da aplicação, decoração e novas visualizações.

### FE-TW-002: Valores compilados não são tokens da runtime

Utilities como `px-3`, `rounded-md` e `duration-200` normalmente são compiladas em constantes. Elas oferecem uma base consistente, mas não mudam quando uma facade troca variáveis de tema da runtime.

### FE-TW-003: Aparência compartilhada acompanha a semântica da runtime

Quando uma propriedade visual precisa acompanhar um equivalente PrimeVue entre temas, use uma utility semântica documentada e apoiada pela runtime ou um token público direto. Uma utility fixa só é permitida quando a propriedade está explicitamente classificada como `platform-invariant`.

### FE-TW-004: Mapeamentos protegidos preservam seu significado

Módulos podem estender o preset, mas não podem redefinir de forma incompatível as semânticas protegidas de primary, surface, severity, text, content, highlight ou controles portáveis.

### FE-TOKEN-001: Todo token deve existir

Cada referência `--p-*` deve estar presente no manifest gerado selecionado.

### FE-TOKEN-002: Nomes de tokens não são APIs dedutíveis

Nunca construa um token por analogia. Pesquise o [Catálogo de tokens](./micro-frontends/token-catalogue.md) ou o manifest do pacote selecionado.

## Acessibilidade

### FE-A11Y-001: Personalização não dispensa acessibilidade

Uma exceção para controle personalizado deve preservar HTML válido, interação por teclado, foco, nome acessível, estado e comportamento desativado. Elementos interativos não podem ser aninhados.
