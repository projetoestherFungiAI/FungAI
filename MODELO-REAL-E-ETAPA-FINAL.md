# Como chegar às 8 classes do diário

A aplicação já usa uma IA real. Porém, o modelo público escolhido reconhece classes do PlantVillage e não exatamente todas as classes do diário.

Para uma banca, a forma tecnicamente correta de apresentar:

> “O protótipo integra uma rede neural pré-treinada em PlantVillage para validar o pipeline de visão computacional. A versão final deve ser treinada/fine-tunada com uma base específica das classes do projeto.”

Não faça um mapeamento artificial de uma classe para outra. Por exemplo, não transforme “mancha foliar” automaticamente em “Alternaria” só porque os sintomas podem parecer parecidos. Isso criaria uma previsão falsa.

## Pipeline final

1. Coletar imagens autorizadas e rotuladas.
2. Classes: saudável + 8 classes do diário.
3. Separar treino/validação/teste.
4. Treinar MobileNetV2/EfficientNet ou modelo equivalente.
5. Avaliar matriz de confusão, precisão, recall e F1 por classe.
6. Calibrar a confiança.
7. Converter o modelo para TensorFlow.js.
8. Colocar `model.json` e os shards na hospedagem.
9. Trocar `MODEL_URL` em `js/ai.js`.
10. Revalidar o app com imagens que não participaram do treinamento.

## Por que existe “incerteza”?

O app mostra a probabilidade da classe principal e também as alternativas. Isso evita transformar uma previsão de 45% em uma certeza de 100%.

Uma implementação científica ainda melhor pode usar calibração de temperatura, ensembles ou técnicas específicas de incerteza. O protótipo atual usa uma apresentação simples e transparente da incerteza.
