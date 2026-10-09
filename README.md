# FungiScan — PWA detector de doenças em folhas

Protótipo acadêmico baseado no diário de bordo **“Sistema Inteligente de Detecção Fúngica com Modelagem de Incerteza”**.

## Tecnologias

- HTML5
- CSS3
- JavaScript
- TensorFlow.js
- PWA / Service Worker
- Modelo de classificação baseado no PlantVillage

## O que já funciona

1. Foto pela câmera do celular.
2. Upload de imagem.
3. Pré-visualização.
4. Carregamento de uma rede neural real no navegador.
5. Pré-processamento 224×224 + normalização.
6. Classificação.
7. Top-5 previsões.
8. Percentual de confiança.
9. Estimativa simples de incerteza.
10. Interface responsiva.
11. Instalação como PWA.
12. Cache dos arquivos da aplicação e tentativa de cache dos pesos do modelo.

## Como executar

Não abra com `file:///`. O Service Worker e vários recursos do navegador exigem HTTP/HTTPS.

### Opção 1 — VS Code

Instale uma extensão de servidor local, como Live Server, e abra `index.html`.

### Opção 2 — Python

No terminal, dentro da pasta:

```bash
python -m http.server 5500
```

Depois acesse:

```text
http://localhost:5500
```

### Opção 3 — GitHub Pages

Envie todos os arquivos para um repositório público e ative Pages. A PWA funcionará em HTTPS.

## IA real utilizada

A pasta não inclui os pesos do modelo para evitar colocar centenas de MB no projeto. O `js/ai.js` carrega o modelo TFJS diretamente do repositório público configurado em `MODEL_URL`.

O modelo reconhece 38 categorias do PlantVillage. Portanto, ele é uma IA real, mas **não é correto dizer que ele já foi treinado exatamente para as 8 doenças do seu diário**.

### Classes do diário

- Saudável
- Mancha de Alternaria
- Oídio
- Ferrugem
- Cercosporiose
- Antracnose
- Mofo cinzento
- Mancha foliar
- Podridão radicular

## Para transformar o protótipo em um modelo específico do projeto

A versão científica/final deve ser treinada com imagens próprias e rótulos dessas 9 classes. O ideal é manter conjuntos separados de treino, validação e teste por folha/planta, evitando que fotos quase idênticas apareçam nos dois conjuntos.

Depois, converta o modelo para TensorFlow.js e substitua `MODEL_URL` por um modelo seu.

## Limitação importante

PlantVillage contém 54.303 imagens em 38 categorias, mas imagens de laboratório/condições controladas não representam toda a variedade de fotos de campo. Uma previsão de alta confiança também não significa diagnóstico garantido.

O app foi desenhado para **triagem acadêmica**, não para prescrever tratamento.

## Treinamento personalizado e persistência

A PWA agora suporta treinamento de um classificador específico do projeto diretamente no navegador, usando **MobileNetV2 como extrator de características + uma rede neural de classificação treinada no TensorFlow.js**.

### Estrutura do conjunto de imagens

No computador, crie uma pasta `dataset` com estas subpastas:

```text
dataset/
├── saudavel/
├── alternaria/
├── oidio/
├── ferrugem/
├── cercosporiose/
├── antracnose/
├── mofo_cinzento/
├── mancha_foliar/
└── podridao_radicular/
```

Coloque as imagens correspondentes dentro de cada pasta. Na PWA, clique em **Selecionar pasta do conjunto de dados** e escolha a pasta `dataset`.

### Persistência

Depois do treinamento, o classificador é salvo com:

```text
indexeddb://fungiscan-custom-classifier-v1
```

Ao abrir a PWA novamente no **mesmo navegador e dispositivo**, ela procura esse modelo e o carrega automaticamente. Fechar a aba ou reiniciar o computador não apaga o modelo. Limpar os dados do site, usar outro navegador/dispositivo ou apagar o modelo pelo botão da PWA remove essa cópia local.

### Exportação

A PWA também possui **Exportar modelo treinado**, que baixa os arquivos do modelo para backup ou futura publicação. O arquivo exportado não é automaticamente colocado no GitHub; isso é uma etapa separada.

### Importante

O treinamento no navegador é adequado para protótipo/experimento, mas para uma versão científica mais robusta é melhor treinar com um conjunto grande e bem rotulado em um computador e depois publicar o modelo final. A confiança exibida é uma probabilidade do classificador, não uma garantia de diagnóstico agronômico.
