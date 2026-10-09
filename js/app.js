(() => {
  const $ = id => document.getElementById(id);
  const els = {
    modelStatus:$("modelStatus"), cameraInput:$("cameraInput"), fileInput:$("fileInput"),
    previewImage:$("previewImage"), previewWrap:$("previewWrap"), sourceLabel:$("sourceLabel"),
    analyzeBtn:$("analyzeBtn"), clearBtn:$("clearBtn"), scanOverlay:$("scanOverlay"),
    resultEmpty:$("resultEmpty"), resultContent:$("resultContent"), errorBox:$("errorBox"),
    healthBanner:$("healthBanner"), healthIcon:$("healthIcon"), healthText:$("healthText"),
    diseaseName:$("diseaseName"), diseaseDescription:$("diseaseDescription"),
    confidenceText:$("confidenceText"), confidenceBar:$("confidenceBar"),
    confidenceBadge:$("confidenceBadge"), uncertaintyText:$("uncertaintyText"),
    topPredictions:$("topPredictions"), recommendation:$("recommendation"),
    projectClasses:$("projectClasses"), toast:$("toast"),
    installBanner:$("installBanner"),installBtn:$("installBtn"),closeInstall:$("closeInstall"),
    datasetInput:$("datasetInput"),datasetInfo:$("datasetInfo"),trainBtn:$("trainBtn"),trainingStatus:$("trainingStatus"),trainingProgressBar:$("trainingProgressBar"),customModelBadge:$("customModelBadge"),savedModelInfo:$("savedModelInfo"),exportModelBtn:$("exportModelBtn"),deleteModelBtn:$("deleteModelBtn")
  };

  let currentFile = null, deferredInstall = null;

  function toast(msg){
    els.toast.textContent=msg;els.toast.classList.add("show");
    clearTimeout(toast.t);toast.t=setTimeout(()=>els.toast.classList.remove("show"),2600);
  }

  function setStatus(text,type="loading"){
    els.modelStatus.textContent=text;els.modelStatus.className=`status-pill ${type}`;
  }

  function updateTrainingUI(meta){
    const trained=Boolean(meta);
    els.customModelBadge.textContent=trained ? "Modelo personalizado: salvo ✓" : "Modelo personalizado: não treinado";
    els.customModelBadge.style.color=trained ? "#8ef19b" : "";
    els.exportModelBtn.disabled=!trained;
    els.deleteModelBtn.disabled=!trained;
    if(trained){
      const date=new Date(meta.savedAt).toLocaleString("pt-BR");
      els.savedModelInfo.innerHTML=`<strong>✓ Modelo disponível neste navegador.</strong><br>Treinado em ${date} • ${meta.trainingExamples} exemplos de treino • ${meta.validationExamples} de validação • ${meta.epochs} épocas.<br><span>Se você fechar a PWA e voltar pelo mesmo navegador, o modelo será carregado automaticamente. Limpar os dados do site remove o modelo.</span>`;
    }else{
      els.savedModelInfo.textContent="Nenhum modelo personalizado salvo ainda.";
    }
  }

  function trainingProgress(msg){
    els.trainingStatus.textContent=msg;
    const match=msg.match(/(\d+)\/(\d+)/);
    if(match){ els.trainingProgressBar.style.width=`${Math.min(100,Number(match[1])/Number(match[2])*100)}%`; }
    if(/salvo|pronta|✓/i.test(msg)) els.trainingProgressBar.style.width="100%";
  }

  function setupTraining(){
    updateTrainingUI(FungiTrainer.getMeta());
    els.datasetInput.addEventListener("change", e=>{
      const files=Array.from(e.target.files || []);
      els.datasetInfo.textContent=files.length ? `${files.length} arquivos selecionados. O treinamento usa somente as imagens dentro das 9 pastas reconhecidas.` : "Nenhum conjunto selecionado.";
      els.trainBtn.disabled=files.length===0;
    });
    els.trainBtn.addEventListener("click", async()=>{
      const files=Array.from(els.datasetInput.files || []);
      if(!files.length) return;
      els.trainBtn.disabled=true; els.datasetInput.disabled=true; els.exportModelBtn.disabled=true; els.deleteModelBtn.disabled=true;
      els.trainingProgressBar.style.width="1%";
      try{
        const meta=await FungiTrainer.train(files,{epochs:12,onProgress:trainingProgress});
        await FungiAI.refreshCustom();
        updateTrainingUI(meta);
        setStatus("IA personalizada pronta","ok");
        toast("Modelo treinado e salvo neste navegador ✓");
      }catch(err){
        console.error(err);
        trainingProgress(`Erro: ${err.message || "não foi possível treinar"}`);
        showError(`Treinamento não concluído. ${err.message || "Verifique as pastas e as imagens."}`);
      }finally{
        els.datasetInput.disabled=false; els.trainBtn.disabled=!(els.datasetInput.files && els.datasetInput.files.length);
        updateTrainingUI(FungiTrainer.getMeta());
      }
    });
    els.exportModelBtn.addEventListener("click", async()=>{
      try{ await FungiTrainer.exportModel(); toast("Exportação iniciada: modelo.json + pesos."); }
      catch(err){ showError(err.message); }
    });
    els.deleteModelBtn.addEventListener("click", async()=>{
      if(!confirm("Apagar o modelo treinado deste navegador? Será necessário treinar novamente para recuperá-lo.")) return;
      await FungiTrainer.removeModel(); updateTrainingUI(null); await FungiAI.refreshCustom();
      setStatus("IA de demonstração","loading"); toast("Modelo personalizado apagado.");
    });
  }

  function renderProjectClasses(){
    els.projectClasses.innerHTML = window.PROJECT_DISEASES.map(d =>
      `<div class="class-item"><strong>${d.icon} ${d.name}</strong><span>${d.description}</span></div>`
    ).join("");
  }

  function showError(msg){
    els.errorBox.textContent=msg;els.errorBox.classList.remove("hidden");
  }
  function clearError(){els.errorBox.classList.add("hidden");els.errorBox.textContent=""}

  function readFile(file){
    if(!file || !file.type.startsWith("image/")) return showError("Escolha um arquivo de imagem válido.");
    currentFile=file;clearError();
    const url=URL.createObjectURL(file);
    els.previewImage.onload=()=>URL.revokeObjectURL(url);
    els.previewImage.src=url;
    els.previewImage.classList.remove("hidden");
    els.previewWrap.querySelector(".empty-preview")?.classList.add("hidden");
    els.sourceLabel.textContent=file.name || "Foto da câmera";
    els.analyzeBtn.disabled=false;els.clearBtn.classList.remove("hidden");
    els.resultEmpty.classList.remove("hidden");els.resultContent.classList.add("hidden");
    toast("Imagem pronta para análise.");
  }

  function clearImage(){
    currentFile=null;els.previewImage.src="";els.previewImage.classList.add("hidden");
    els.previewWrap.querySelector(".empty-preview")?.classList.remove("hidden");
    els.sourceLabel.textContent="Nenhuma imagem";els.analyzeBtn.disabled=true;els.clearBtn.classList.add("hidden");
  }

  function diseaseDescription(result){
    const raw=result.top.label.toLowerCase();
    if(raw.includes("powdery_mildew")) return "Oídio é uma doença fúngica representada no modelo PlantVillage.";
    if(raw.includes("cercospora") || raw.includes("gray_leaf_spot")) return "A previsão é compatível com cercosporiose/mancha cinzenta em milho.";
    if(raw.includes("rust")) return "A previsão corresponde a uma classe de ferrugem disponível no modelo.";
    if(raw.includes("leaf_spot") || raw.includes("target_spot") || raw.includes("septoria")) return "A previsão pertence ao grupo de manchas foliares reconhecidas pelo modelo.";
    if(raw.includes("healthy")) return "A imagem foi classificada como saudável dentro das classes aprendidas pelo modelo.";
    return "A rede neural identificou esta classe entre as categorias que conhece.";
  }

  function recommendation(result){
    if(result.confidence < .55) return "⚠️ Confiança baixa. Tire outra foto com melhor iluminação, folha inteira visível e fundo menos poluído. Não use o resultado sozinho para decidir tratamento.";
    if(result.confidence < .8) return "🔎 Confiança moderada. Use o resultado como triagem e compare com sintomas reais da planta.";
    if(result.health==="saudavel") return "🌱 A IA não encontrou sinais fortes de doença dentro das categorias que conhece. Isso não garante que a planta esteja livre de qualquer problema.";
    return "🧪 Resultado de triagem. Para confirmação, compare os sintomas e procure orientação de um profissional de agronomia, especialmente antes de aplicar qualquer produto.";
  }

  function renderResult(result){
    els.resultEmpty.classList.add("hidden");els.resultContent.classList.remove("hidden");
    const pct=result.confidence*100;
    els.confidenceText.textContent=`${pct.toFixed(1)}%`;
    els.confidenceBadge.textContent=`${pct.toFixed(1)}% confiança`;
    els.confidenceBar.style.width=`${Math.max(1,pct)}%`;
    els.uncertaintyText.textContent=`Incerteza aproximada: ${(100-pct).toFixed(1)}%. Quanto menor a confiança, mais importante é repetir a foto.`;
    const healthy=result.health==="saudavel";
    els.healthText.textContent=healthy ? "Aparentemente saudável" : "Possível doença / alteração";
    els.healthIcon.textContent=healthy ? "✓" : "!";
    els.healthBanner.style.borderColor=healthy ? "#2d7040" : "#6c5529";
    els.healthBanner.style.background=healthy ? "#102719" : "#2a2110";
    els.diseaseName.textContent=result.top.name;
    els.diseaseDescription.textContent=diseaseDescription(result);
    els.recommendation.textContent=recommendation(result);
    els.topPredictions.innerHTML=result.top5.map(p=>{
      const pPct=p.probability*100;
      return `<div class="prediction"><div><div class="name">${p.name}</div><div class="mini-progress"><span style="width:${Math.max(1,pPct)}%"></span></div></div><div class="pct">${pPct.toFixed(1)}%</div></div>`;
    }).join("");
  }

  async function analyze(){
    if(!currentFile) return;
    clearError();els.analyzeBtn.disabled=true;els.scanOverlay.classList.remove("hidden");
    try{
      const img=await createImageBitmap(currentFile);
      const result=await FungiAI.predict(img);
      img.close?.();
      renderResult(result);
      toast("Análise concluída.");
    }catch(err){
      console.error(err);
      showError(`Não foi possível analisar a imagem. ${err.message || "Verifique se a IA foi carregada e tente novamente."}`);
      toast("Falha na análise.");
    }finally{
      els.scanOverlay.classList.add("hidden");els.analyzeBtn.disabled=!currentFile;
    }
  }

  els.fileInput.addEventListener("change",e=>readFile(e.target.files[0]));
  els.cameraInput.addEventListener("change",e=>readFile(e.target.files[0]));
  els.analyzeBtn.addEventListener("click",analyze);els.clearBtn.addEventListener("click",clearImage);

  window.addEventListener("beforeinstallprompt",e=>{
    e.preventDefault();deferredInstall=e;els.installBanner.classList.remove("hidden");
  });
  els.installBtn.addEventListener("click",async()=>{
    if(!deferredInstall) return;
    deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;els.installBanner.classList.add("hidden");
  });
  els.closeInstall.addEventListener("click",()=>els.installBanner.classList.add("hidden"));
  window.addEventListener("appinstalled",()=>els.installBanner.classList.add("hidden"));

  renderProjectClasses();
  setupTraining();

  (async()=>{
    try{
      await FungiAI.load(msg=>setStatus(msg,"loading"));
      setStatus(FungiAI.customActive ? "IA personalizada pronta" : "IA de demonstração pronta","ok");
    }catch(err){
      console.error(err);setStatus("IA indisponível","error");
      showError("A interface carregou, mas o modelo de IA não pôde ser baixado. Verifique a internet na primeira execução e recarregue a página.");
    }
  })();

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(err=>console.warn("SW:",err)));
  }
})();
