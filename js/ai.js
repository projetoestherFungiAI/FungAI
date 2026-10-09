window.FungiAI = (() => {
  const MODEL_URL = "https://raw.githubusercontent.com/rexsimiloluwah/PLANT-DISEASE-CLASSIFIER-WEB-APP-TENSORFLOWJS/master/tensorflowjs-model/model.json";
  const INPUT_SIZE = 224;
  const NUM_CLASSES = 38;
  let model = null;
  let customActive = false;
  const labels = [
    "Apple___Apple_scab","Apple___Black_rot","Apple___Cedar_apple_rust","Apple___healthy",
    "Blueberry___healthy","Cherry_(including_sour)___Powdery_mildew","Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot","Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight","Corn_(maize)___healthy",
    "Grape___Black_rot","Grape___Esca_(Black_Measles)","Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy","Orange___Haunglongbing_(Citrus_greening)","Peach___Bacterial_spot","Peach___healthy",
    "Pepper,_bell___Bacterial_spot","Pepper,_bell___healthy","Potato___Early_blight","Potato___Late_blight",
    "Potato___healthy","Raspberry___healthy","Soybean___healthy","Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch","Strawberry___healthy","Tomato___Bacterial_spot","Tomato___Early_blight",
    "Tomato___Late_blight","Tomato___Leaf_Mold","Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite","Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus","Tomato___Tomato_mosaic_virus","Tomato___healthy"
  ];
  function softmax(arr){ const max=Math.max(...arr); const exps=arr.map(v=>Math.exp(v-max)); const sum=exps.reduce((a,b)=>a+b,0); return exps.map(v=>v/sum); }
  async function load(onProgress){
    if(await FungiTrainer.hasModel()){
      customActive=true;
      await FungiTrainer.loadSaved(onProgress);
      onProgress?.("IA personalizada pronta ✓");
      return "custom";
    }
    if(model) return "plantvillage";
    if(!window.tf) throw new Error("TensorFlow.js não foi carregado.");
    await tf.ready();
    onProgress?.("Baixando modelo de demonstração…");
    model=await tf.loadLayersModel(MODEL_URL,{onProgress:p=>onProgress?.(`Baixando modelo de demonstração… ${Math.round(p*100)}%`)});
    const warm=tf.zeros([1,INPUT_SIZE,INPUT_SIZE,3]); const out=model.predict(warm); if(Array.isArray(out)) out.forEach(t=>t.dispose()); else out.dispose(); warm.dispose();
    onProgress?.("IA de demonstração pronta");
    return "plantvillage";
  }
  function preprocess(img){ return tf.tidy(()=>tf.browser.fromPixels(img).resizeBilinear([INPUT_SIZE,INPUT_SIZE]).toFloat().div(255).expandDims(0)); }
  function humanize(raw){ return window.MODEL_LABELS?.[raw] || raw.replaceAll("___"," — ").replaceAll("_"," "); }
  async function predict(img){
    if(await FungiTrainer.hasModel()){
      customActive=true;
      return await FungiTrainer.predict(img);
    }
    if(!model) await load();
    const input=preprocess(img); let output=model.predict(input); if(Array.isArray(output)) output=output[0];
    const raw=Array.from(await output.data()); input.dispose(); output.dispose();
    const isProb=raw.every(v=>v>=0&&v<=1)&&Math.abs(raw.reduce((a,b)=>a+b,0)-1)<.05;
    const probs=isProb?raw:softmax(raw);
    const ranked=probs.map((p,i)=>({index:i,label:labels[i],name:humanize(labels[i]),probability:p})).sort((a,b)=>b.probability-a.probability);
    const top=ranked[0];
    return {top,top5:ranked.slice(0,5),confidence:top.probability,health:top.label.toLowerCase().includes('healthy')?'saudavel':'doente',model:'PlantVillage / TensorFlow.js',inputSize:INPUT_SIZE};
  }
  async function refreshCustom(){ customActive=await FungiTrainer.hasModel(); return customActive; }
  return {load,predict,refreshCustom,MODEL_URL,INPUT_SIZE,labels,get customActive(){return customActive;}};
})();
