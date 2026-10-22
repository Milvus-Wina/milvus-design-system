import { LightningElement } from "lwc";
import { loadBrand } from "c/milvusScript";

/**
 * 앱 전체 브랜드 로더. 유틸리티 바에 항목 버튼으로 보이지만 패널에는 아무것도 그리지 않는다.
 * App Manager에서 앱의 유틸리티 바에 넣고 "앱이 열릴 때 백그라운드로 로드"를 켜면 그 앱의 모든 페이지에 브랜드 CSS가 들어간다.
 * 템플릿에 기본 컴포넌트가 없으므로 detectNativeShadow는 부르지 않는다.
 */
export default class MilvusBrandLoader extends LightningElement {
  connectedCallback() {
    loadBrand(this);
  }
}
