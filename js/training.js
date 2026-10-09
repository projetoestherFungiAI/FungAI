window.FungiTrainer = (() => {
  const MODEL_KEY = 'indexeddb://fungiscan-custom-classifier-6classes-v1';
  const META_KEY = 'fungiscan-custom-meta-6classes-v1';

  const IMAGE_SIZE = 224;

  // SOMENTE AS 6 CLASSES QUE POSSUEM IMAGENS
  const CLASSES = [
    {
      id: 'saudavel',
      name: 'Saudável',
      icon: '🌱'
    },
    {
      id: 'oidio',
      name: 'Oídio',
      icon: '☁️'
    },
    {
      id: 'ferrugem',
      name: 'Ferrugem',
      icon: '🟤'
    },
    {
      id: 'antracnose',
      name: 'Antracnose',
      icon: '🍃'
    },
    {
      id: 'mofo_cinzento',
      name: 'Mofo Cinzento',
      icon: '🌫️'
    },
    {
      id: 'mancha_foliar',
      name: 'Mancha Foliar',
      icon: '🔴'
    }
  ];

  let mobilenetModel = null;
  let classifier = null;
  let loadingPromise = null;


  // =========================================================
  // CARREGAR MOBILENET
  // =========================================================

  async function loadBase(onProgress) {

    if (mobilenetModel) {
      return mobilenetModel;
    }

    if (loadingPromise) {
      return loadingPromise;
    }

    if (!window.tf || !window.mobilenet) {
      throw new Error(
        'TensorFlow.js ou MobileNet não foi carregado.'
      );
    }

    loadingPromise = (async () => {

      onProgress?.(
        'Carregando base visual MobileNet…'
      );

      await tf.ready();

      mobilenetModel =
        await window.mobilenet.load({
          version: 2,
          alpha: 1.0
        });

      onProgress?.(
        'Base visual pronta'
      );

      return mobilenetModel;

    })();

    try {

      return await loadingPromise;

    } finally {

      loadingPromise = null;

    }
  }


  // =========================================================
  // METADADOS
  // =========================================================

  function readMeta() {

    try {

      return JSON.parse(
        localStorage.getItem(META_KEY) || 'null'
      );

    } catch {

      return null;

    }
  }


  // =========================================================
  // VERIFICAR SE EXISTE MODELO
  // =========================================================

  async function hasModel() {

    try {

      const models =
        await tf.io.listModels();

      return Boolean(
        models[MODEL_KEY]
      );

    } catch {

      return false;

    }
  }


  // =========================================================
  // CARREGAR MODELO SALVO
  // =========================================================

  async function loadSaved(onProgress) {

    if (classifier) {
      return classifier;
    }

    if (!(await hasModel())) {
      return null;
    }

    await loadBase(onProgress);

    onProgress?.(
      'Carregando modelo treinado salvo…'
    );

    classifier =
      await tf.loadLayersModel(
        MODEL_KEY
      );

    onProgress?.(
      'Modelo treinado carregado'
    );

    return classifier;
  }


  // =========================================================
  // CRIAR CLASSIFICADOR
  // =========================================================

  function makeClassifier(
    numClasses,
    embeddingSize = 1280
  ) {

    const model =
      tf.sequential();

    model.add(
      tf.layers.dense({
        inputShape: [embeddingSize],
        units: 128,
        activation: 'relu'
      })
    );

    model.add(
      tf.layers.dropout({
        rate: 0.20
      })
    );

    model.add(
      tf.layers.dense({
        units: numClasses,
        activation: 'softmax'
      })
    );

    model.compile({
      optimizer:
        tf.train.adam(0.001),

      loss:
        'sparseCategoricalCrossentropy',

      metrics: [
        'accuracy'
      ]
    });

    return model;
  }


  // =========================================================
  // TRANSFORMAR ARQUIVO EM IMAGEM
  // =========================================================

  async function fileToImage(file) {

    if ('createImageBitmap' in window) {

      const bitmap =
        await createImageBitmap(file);

      return {
        image: bitmap,

        close: () => {
          bitmap.close?.();
        }
      };
    }

    return await new Promise(
      (resolve, reject) => {

        const img =
          new Image();

        const url =
          URL.createObjectURL(file);

        img.onload = () => {

          URL.revokeObjectURL(url);

          resolve({
            image: img,
            close: () => {}
          });

        };

        img.onerror = () => {

          URL.revokeObjectURL(url);

          reject(
            new Error(
              `Não foi possível ler ${file.name}`
            )
          );

        };

        img.src = url;
      }
    );
  }


  // =========================================================
  // CRIAR EMBEDDING
  // =========================================================
  //
  // Esta é a versão simples que estava funcionando
  // antes do problema das pastas vazias.
  //
  // NÃO usa flip.
  // NÃO usa aumento de dados.
  // =========================================================

  function makeEmbedding(image) {

    return tf.tidy(() => {

      let x =
        tf.browser.fromPixels(image)
          .toFloat();

      x =
        tf.image.resizeBilinear(
          x,
          [
            IMAGE_SIZE,
            IMAGE_SIZE
          ]
        );

      return mobilenetModel
        .infer(x, true)
        .squeeze();

    });
  }


  // =========================================================
  // EXTRAIR DATASET
  // =========================================================

  async function extractDataset(
    files,
    onProgress
  ) {

    await loadBase(
      onProgress
    );

    const rows = [];

    let embeddingSize = null;

    const allowed =
      /\.(jpg|jpeg|png|webp|bmp)$/i;

    const imageFiles =
      Array.from(files).filter(
        f =>
          f.type.startsWith(
            'image/'
          ) ||
          allowed.test(f.name)
      );

    if (!imageFiles.length) {

      throw new Error(
        'Nenhuma imagem foi encontrada.'
      );

    }


    for (
      let i = 0;
      i < imageFiles.length;
      i++
    ) {

      const file =
        imageFiles[i];

      const path =
        file.webkitRelativePath ||
        file.name;

      const parts =
        path.split('/');

      const folder =
        parts.length > 1
          ? parts[
              parts.length - 2
            ]
          : '';


      // PROCURA SOMENTE ENTRE AS 6 CLASSES
      const cls =
        CLASSES.find(
          c =>
            c.id === folder ||
            c.name.toLowerCase() ===
              folder.toLowerCase()
        );


      // Qualquer outra pasta é ignorada
      if (!cls) {
        continue;
      }


      const item =
        await fileToImage(file);


      try {

        const emb =
          makeEmbedding(
            item.image
          );


        if (!embeddingSize) {

          embeddingSize =
            emb.shape[
              emb.shape.length - 1
            ];

        }


        rows.push({

          emb,

          label:
            CLASSES.findIndex(
              c =>
                c.id === cls.id
            )

        });

      } finally {

        item.close();

      }


      if (
        i % 2 === 0 ||
        i ===
          imageFiles.length - 1
      ) {

        onProgress?.(
          `Processando imagens: ${i + 1}/${imageFiles.length}`
        );

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              0
            )
        );

      }

    }


    if (!rows.length) {

      throw new Error(
        'Não encontrei imagens nas pastas reconhecidas. ' +
        'Use estas 6 pastas: ' +
        CLASSES
          .map(c => c.id)
          .join(', ')
      );

    }


    rows.embeddingSize =
      embeddingSize;

    return rows;
  }


  // =========================================================
  // DIVIDIR TREINO / VALIDAÇÃO
  // =========================================================

  function splitRows(rows) {

    const byClass =
      new Map(
        CLASSES.map(
          (_, i) => [
            i,
            []
          ]
        )
      );


    rows.forEach(row => {

      byClass
        .get(row.label)
        .push(row);

    });


    const train = [];
    const val = [];


    for (
      const [
        label,
        arr
      ] of byClass
    ) {

      tf.util.shuffle(arr);


      const cut =
        Math.max(
          1,
          Math.floor(
            arr.length * 0.8
          )
        );


      arr
        .slice(0, cut)
        .forEach(row => {

          train.push({
            ...row,
            label
          });

        });


      arr
        .slice(cut)
        .forEach(row => {

          val.push({
            ...row,
            label
          });

        });

    }


    return {
      train,
      val,
      byClass
    };
  }


  // =========================================================
  // TREINAMENTO
  // =========================================================

  async function train(
    files,
    options = {}
  ) {

    const onProgress =
      options.onProgress ||
      (() => {});


    if (files.length < 20) {

      throw new Error(
        'Use pelo menos 20 imagens. ' +
        'Para um resultado melhor, tente usar dezenas de imagens por classe.'
      );

    }


    const rows =
      await extractDataset(
        files,
        onProgress
      );


    const {
      train,
      val,
      byClass
    } =
      splitRows(rows);


    // VERIFICA SOMENTE AS 6 CLASSES
    const missing =
      CLASSES.filter(
        (_, i) =>
          !(
            byClass
              .get(i)
              ?.length
          )
      );


    if (missing.length) {

      rows.forEach(
        row =>
          row.emb.dispose()
      );


      throw new Error(
        'Faltam imagens para: ' +
        missing
          .map(
            c => c.name
          )
          .join(', ') +
        '. Cada uma das 6 pastas precisa ter imagens.'
      );

    }


    const xsTrain =
      tf.stack(
        train.map(
          r => r.emb
        )
      );


    const ysTrain =
      tf.tensor1d(
        train.map(
          r => r.label
        ),
        'float32'
      );


    const xsVal =
      val.length
        ? tf.stack(
            val.map(
              r => r.emb
            )
          )
        : null;


    const ysVal =
      val.length
        ? tf.tensor1d(
            val.map(
              r => r.label
            ),
            'float32'
          )
        : null;


    rows.forEach(
      r =>
        r.emb.dispose()
    );


    if (classifier) {

      classifier.dispose();

    }


    classifier =
      makeClassifier(
        CLASSES.length,
        rows.embeddingSize ||
          1280
      );


    const epochs =
      Number(
        options.epochs || 12
      );


    onProgress?.(
      `Treinando rede neural: época 0/${epochs}`
    );


    try {

      await classifier.fit(
        xsTrain,
        ysTrain,
        {

          epochs,

          batchSize:
            Math.min(
              32,
              Math.max(
                4,
                Math.floor(
                  train.length / 4
                )
              )
            ),

          shuffle: true,

          validationData:
            xsVal
              ? [
                  xsVal,
                  ysVal
                ]
              : undefined,


          callbacks: {

            onEpochEnd:
              async (
                epoch,
                logs
              ) => {

                const acc =
                  (
                    (
                      logs.acc ??
                      logs.accuracy ??
                      0
                    ) * 100
                  ).toFixed(1);


                const valAcc =
                  logs.val_acc ??
                  logs.val_accuracy;


                const extra =
                  valAcc == null
                    ? ''
                    : ` • validação ${(valAcc * 100).toFixed(1)}%`;


                onProgress?.(
                  `Treinando rede neural: época ${epoch + 1}/${epochs} • precisão ${acc}%${extra}`
                );


                await tf.nextFrame();

              }

          }

        }
      );


      await classifier.save(
        MODEL_KEY
      );


      const meta = {

        version: 1,

        savedAt:
          new Date()
            .toISOString(),

        classes:
          CLASSES,

        imageCount:
          files.length,

        trainingExamples:
          train.length,

        validationExamples:
          val.length,

        epochs,

        backbone:
          `MobileNetV2 ImageNet + classificador treinado no navegador (${rows.embeddingSize || 1280} características)`

      };


      localStorage.setItem(
        META_KEY,
        JSON.stringify(meta)
      );


      onProgress?.(
        'Modelo treinado e salvo neste navegador ✓'
      );


      return meta;


    } finally {

      xsTrain.dispose();

      ysTrain.dispose();

      xsVal?.dispose();

      ysVal?.dispose();

    }

  }


  // =========================================================
  // PREVISÃO
  // =========================================================

  async function predict(image) {

    if (!classifier) {

      const loaded =
        await loadSaved();

      if (!loaded) {

        throw new Error(
          'Ainda não existe um modelo específico treinado. ' +
          'Vá à seção Treinamento e treine o modelo primeiro.'
        );

      }

    }


    await loadBase();


    const emb =
      makeEmbedding(
        image
      ).expandDims(0);


    const out =
      classifier.predict(
        emb
      );


    const data =
      Array.from(
        await out.data()
      );


    emb.dispose();

    out.dispose();


    const ranked =
      data
        .map(
          (p, i) => ({

            index: i,

            ...CLASSES[i],

            probability: p

          })
        )
        .sort(
          (a, b) =>
            b.probability -
            a.probability
        );


    const top =
      ranked[0];


    return {

      top,

      top5:
        ranked.slice(
          0,
          5
        ),

      confidence:
        top.probability,

      health:
        top.id === 'saudavel'
          ? 'saudavel'
          : 'doente',

      model:
        'FungiScan customizado',

      inputSize:
        IMAGE_SIZE

    };

  }


  // =========================================================
  // APAGAR MODELO
  // =========================================================

  async function removeModel() {

    try {

      await tf.io.removeModel(
        MODEL_KEY
      );

    } catch {}


    classifier?.dispose();

    classifier = null;


    localStorage.removeItem(
      META_KEY
    );

  }


  // =========================================================
  // EXPORTAR MODELO
  // =========================================================

  async function exportModel() {

    if (!(await hasModel())) {

      throw new Error(
        'Não há modelo treinado para exportar.'
      );

    }


    const model =
      await tf.loadLayersModel(
        MODEL_KEY
      );


    try {

      await model.save(
        'downloads://fungiscan-modelo-treinado'
      );

    } finally {

      model.dispose();

    }

  }


  function getMeta() {

    return readMeta();

  }


  return {

    CLASSES,

    MODEL_KEY,

    loadSaved,

    hasModel,

    train,

    predict,

    removeModel,

    exportModel,

    getMeta,

    loadBase

  };

})();