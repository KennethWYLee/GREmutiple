import raw from '../data/questions.json';import type {Question} from './model';
export const allQuestions=raw as Question[];
export const questions=allQuestions.filter(q=>q.valid);
export const questionMap=new Map(questions.map(q=>[q.id,q]));
export const bankInfo=(['B','C','D'] as const).map((id,i)=>({id,name:['培訓班','衝刺班','機經模考'][i],description:['建立字彙與填空基礎','精進語意與邏輯判讀','整合練習與四組模考'][i],total:allQuestions.filter(q=>q.bank===id).length,available:questions.filter(q=>q.bank===id).length}));
export function publicQuestion(q:Question){const {answers,notes,valid,disputed,codexExplanation,issue,...visible}=q;return visible}

