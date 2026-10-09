// Mantido separado para facilitar futuras extensões de câmera ao vivo.
// O fluxo atual usa <input type="file" capture="environment"> porque é mais
// compatível com navegadores móveis e PWA.
window.FungiCamera = {
  supported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
  async requestPermission(){
    if(!this.supported) throw new Error("Este navegador não oferece acesso à câmera.");
    const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
    stream.getTracks().forEach(t=>t.stop());
    return true;
  }
};
