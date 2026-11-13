import { soloVoice, visibleLegalNames, parseTrustPopup } from "../../src/lib/trust-popup";
const c = parseTrustPopup(JSON.stringify({ enabled: true, people: [{ name: "Bùi An", phone: "0397943155" }, { name: "Tăng Linh", phone: "0357452952", hidden: true }] }));
console.log(visibleLegalNames(c), "|", soloVoice("Tụi mình báo ngay; khi đó tụi mình hỗ trợ.", true));
