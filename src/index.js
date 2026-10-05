import { decodePkt, encodePkt } from "./pkt.js";
import { parseXml } from "./xml.js";
import { parsePktmd, stringifyPktmd } from "./pktmd.js";
import { fromXml, toXml, getTemplate, simplifyNetwork, portNamesOf, describeNetwork } from "./pt.js";
import { resolveLinksSafe } from "./links.js";

export { decodePkt, encodePkt } from "./pkt.js";
export { parsePktmd, stringifyPktmd } from "./pktmd.js";
export { fromXml, toXml, getTemplate, portsFor, simplifyNetwork, portNamesOf, describeNetwork } from "./pt.js";
export { resolveLinks, resolveLinksSafe } from "./links.js";
export { PktmdError } from "./model.js";
export { MODELS, DEFAULT_MODEL } from "./catalog.js";
export { autoLayout, toPtCoords, simulationStep, DEFAULT_PHYSICS, seedPositions } from "./layout.js";
export { createNetworkView } from "./renderer.js";
export { mountNetwork, checkPktmd, previewConfig } from "./embed.js";

/** .pkt (bytes) -> testo .pktmd */
export async function pktToPktmd(bytes, { pos = false } = {}) {
  const tpl = await getTemplate();
  const xml = await decodePkt(bytes);
  const { network, warnings, info } = fromXml(parseXml(xml), tpl);
  const simple = simplifyNetwork(network, info);
  const text = stringifyPktmd(simple, { pos, portsOf: (d) => info.get(d.id)?.inv.map((p) => p.name) ?? [] });
  return { text, network: simple, warnings };
}

/** testo .pktmd -> .pkt (bytes) */
export async function pktmdToPkt(text) {
  const { network, warnings } = parsePktmd(text);
  const xml = await toXml(network, { warnings });
  return { bytes: await encodePkt(xml), xml, network, warnings };
}

