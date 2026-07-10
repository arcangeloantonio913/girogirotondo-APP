import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { tenant } from '../../config/tenant';

const C = { ...tenant.colors, border: tenant.colors.divider };
const QTY = ['tutto','bis','metà','mangiata_poca','lasciata_poca','no'];
const QTY_LABELS: Record<string,string> = { tutto:'Tutto',bis:'Bis','metà':'Metà',mangiata_poca:'Poca',lasciata_poca:'Lasciata',no:'No' };
const QTY_COLORS: Record<string,{bg:string;text:string}> = {
  tutto:{bg:'#D1FAE5',text:'#065F46'},bis:{bg:'#A7F3D0',text:'#065F46'},
  'metà':{bg:'#FEF9C3',text:'#854D0E'},mangiata_poca:{bg:'#FEE2E2',text:'#991B1B'},
  lasciata_poca:{bg:'#FECACA',text:'#7F1D1D'},no:{bg:'#F1F5F9',text:'#64748B'},
};
const MEALS = [
  {key:'merenda_mattina',label:'Merenda mattina',icon:'☕'},
  {key:'pasta',label:'Pasta',icon:'🍝'},
  {key:'secondo',label:'Secondo',icon:'🍗'},
  {key:'pane',label:'Pane',icon:'🍞'},
  {key:'frutta',label:'Frutta',icon:'🍎'},
];

function addDays(dateStr:string,n:number){const d=new Date(dateStr+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().split('T')[0];}

export default function TeacherGriglia() {
  const { user } = useAuth();
  const classId = user?.class_ids?.[0] || user?.class_id;
  const [date, setDate]       = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<any[]>([]);
  const [griglia, setGriglia]  = useState<Record<string,any>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string|null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  useEffect(()=>{
    if(!classId){setLoading(false);return;}
    api.get(`/students?class_id=${classId}`).then(r=>setStudents(r.data||[])).catch(()=>{}).finally(()=>setLoading(false));
  },[classId]);

  useEffect(()=>{
    if(!classId)return;
    api.get(`/griglia?class_id=${classId}&date=${date}`).then(r=>{
      const map:Record<string,any>={};
      // Rimappa il doc backend nel formato-stato usato da updateField/render.
      (r.data||[]).forEach((g:any)=>{map[g.student_id]={
        student_id:      g.student_id,
        merenda_mattina: g.merenda_qty || '',
        pasta:           g.pasta_qty   || '',
        secondo:         g.secondo_qty || '',
        pane:            g.pane_qty    || '',
        frutta:          g.frutta_qty  || '',
        'pupù':          !!g.pupu,
        nanna:           !!g.nanna,
        notes:           g.notes || '',
      };});
      setGriglia(map);
    }).catch(()=>{});
  },[date,classId]);

  const updateField=(sid:string,field:string,val:any)=>{
    setGriglia(prev=>({...prev,[sid]:{...(prev[sid]||{student_id:sid}),[field]:val}}));
  };

  const applyBulk=(field:string,val:any)=>{
    if(selected.size===0){Alert.alert('Seleziona almeno un alunno');return;}
    setGriglia(prev=>{
      const next={...prev};
      selected.forEach(sid=>{next[sid]={...(next[sid]||{student_id:sid}),[field]:val};});
      return next;
    });
  };

  const toggleSelect=(sid:string)=>{
    setSelected(prev=>{const next=new Set(prev);next.has(sid)?next.delete(sid):next.add(sid);return next;});
  };
  const selectAll=()=>setSelected(new Set(students.map(s=>s.id)));
  const deselectAll=()=>setSelected(new Set());

  const handleSave=async()=>{
    if(!classId){Alert.alert('Nessuna classe');return;}
    setSaving(true);
    try{
      // [campo_backend, chiave_stato_UI]. Nello stato il valore pasto è la STRINGA quantità.
      const MEAL_MAP:[string,string][]=[
        ['merenda','merenda_mattina'],['pasta','pasta'],['secondo','secondo'],['pane','pane'],['frutta','frutta'],
      ];
      const buildPayload=(st:any)=>{
        const g=griglia[st.id]||{};
        const p:any={class_id:classId,student_ids:[st.id],date};
        for(const [bk,sk] of MEAL_MAP){
          const raw=g[sk];
          // qty: usa la stringa UI; se lo stato è un doc caricato dal backend (bool su bk), leggi bk_qty
          const qty:string = typeof raw==='string' ? raw : (typeof g[bk+'_qty']==='string' ? g[bk+'_qty'] : '');
          p[bk]=qty!==''&&qty!=='no';   // true = ha mangiato qualcosa; '' e 'no' → false
          p[bk+'_qty']=qty;
        }
        p.pupu=!!(g['pupù']??g['pupu']);   // chiave UI accentata 'pupù'; doc caricato usa 'pupu'
        p.nanna=!!g['nanna'];
        p.notes=typeof (g.notes??g.note)==='string' ? (g.notes??g.note) : '';
        return p;
      };
      const sample = students[0] ? buildPayload(students[0]) : null;
      console.log('[GRIGLIA] sample payload:', JSON.stringify(sample));
      console.log('[GRIGLIA] classId:', classId, 'students:', students.length, 'date:', date);
      await Promise.all(students.map(st=>api.post('/griglia',buildPayload(st))));
      setSaved(true);
      setTimeout(()=>setSaved(false),2000);
    }catch(e:any){
      console.log('[GRIGLIA] SAVE ERROR:', e?.message, '| status:', e?.response?.status, '| detail:', JSON.stringify(e?.response?.data));
      Alert.alert('Errore salvataggio', e?.response?.data?.detail || e?.message || 'Impossibile salvare');
    }
    finally{setSaving(false);}
  };

  return (
    <ScreenLayout title="Griglia Pasti" showBack color={C.accentPink} loading={loading} scrollable={false}
      rightAction={
        <TouchableOpacity onPress={handleSave} disabled={saving}
          style={[s.saveBtn,saving&&{opacity:0.5}]}>
          {saved
            ? <><Ionicons name="checkmark-circle" size={16} color="#32CD32"/><Text style={{color:'#32CD32',fontSize:12,fontWeight:'700'}}>Salvato</Text></>
            : <Text style={{color:C.white,fontSize:12,fontWeight:'700'}}>{saving?'...':'Salva'}</Text>
          }
        </TouchableOpacity>
      }
    >
      {/* Date nav */}
      <View style={s.dateNav}>
        <TouchableOpacity onPress={()=>setDate(addDays(date,-1))} style={s.navBtn}>
          <Ionicons name="chevron-back" size={20} color={C.text}/>
        </TouchableOpacity>
        <Text style={s.dateText}>{new Date(date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})}</Text>
        <TouchableOpacity onPress={()=>setDate(addDays(date,1))} style={s.navBtn}
          disabled={date>=new Date().toISOString().split('T')[0]}>
          <Ionicons name="chevron-forward" size={20} color={date>=new Date().toISOString().split('T')[0]?C.muted:C.text}/>
        </TouchableOpacity>
      </View>

      {/* Bulk actions */}
      {selected.size>0&&(
        <View style={s.bulkBar}>
          <Text style={s.bulkLabel}>{selected.size} selezionati — Imposta:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:6}}>
            <View style={{flexDirection:'row',gap:6}}>
              {MEALS.map(m=>(
                <View key={m.key} style={{flexDirection:'row',gap:4,alignItems:'center'}}>
                  <Text style={{fontSize:14}}>{m.icon}</Text>
                  {QTY.map(q=>{
                    const col=QTY_COLORS[q];
                    return(
                      <TouchableOpacity key={q} onPress={()=>applyBulk(m.key,q)}
                        style={[s.qtyMini,{backgroundColor:col.bg}]}>
                        <Text style={[s.qtyMiniText,{color:col.text}]}>{QTY_LABELS[q]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Select all row */}
      <View style={s.selectRow}>
        <TouchableOpacity onPress={selected.size===students.length?deselectAll:selectAll} style={s.selectAllBtn}>
          <Ionicons name={selected.size===students.length?'checkbox':'square-outline'} size={18} color={C.accentPink}/>
          <Text style={{fontSize:12,color:C.muted}}>{selected.size===students.length?'Deseleziona tutti':'Seleziona tutti'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={students}
        keyExtractor={s_=>s_.id}
        contentContainerStyle={{padding:8,paddingBottom:20}}
        renderItem={({item})=>{
          const g=griglia[item.id]||{};
          const isOpen=expanded===item.id;
          const isSelected=selected.has(item.id);
          return(
            <View style={[s.studentCard,isSelected&&s.studentCardSelected]}>
              <View style={s.studentHeader}>
                <TouchableOpacity onPress={()=>toggleSelect(item.id)} style={{padding:4}}>
                  <Ionicons name={isSelected?'checkbox':'square-outline'} size={20} color={isSelected?C.accentPink:C.muted}/>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>setExpanded(isOpen?null:item.id)} style={{flex:1,flexDirection:'row',alignItems:'center',gap:8}}>
                  <Text style={s.studentName}>{item.name} {item.cognome}</Text>
                  {/* Mini summary */}
                  {Object.keys(g).filter(k=>MEALS.map(m=>m.key).includes(k)&&g[k]).length>0&&(
                    <View style={s.miniBadge}>
                      <Text style={s.miniBadgeText}>{Object.keys(g).filter(k=>MEALS.map(m=>m.key).includes(k)&&g[k]).length} piatti</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <Ionicons name={isOpen?'chevron-up':'chevron-down'} size={16} color={C.muted}/>
              </View>

              {isOpen&&(
                <View style={s.fields}>
                  {MEALS.map(meal=>(
                    <View key={meal.key} style={s.mealRow}>
                      <Text style={s.mealIcon}>{meal.icon}</Text>
                      <Text style={s.mealLabel}>{meal.label}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{flexDirection:'row',gap:4}}>
                          {QTY.map(q=>{
                            const col=QTY_COLORS[q];
                            const isSel=g[meal.key]===q;
                            return(
                              <TouchableOpacity key={q} onPress={()=>updateField(item.id,meal.key,q)}
                                style={[s.qtyBtn,{backgroundColor:isSel?col.bg:'#F9FAFB',borderColor:isSel?col.text+'40':C.border}]}>
                                <Text style={[s.qtyBtnText,{color:isSel?col.text:C.muted}]}>{QTY_LABELS[q]}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>
                    </View>
                  ))}
                  {/* Pupù e Nanna */}
                  <View style={s.boolRow}>
                    {[{key:'pupù',icon:'💩',label:'Pupù'},{key:'nanna',icon:'😴',label:'Nanna'}].map(b=>(
                      <TouchableOpacity key={b.key} onPress={()=>updateField(item.id,b.key,!g[b.key])}
                        style={[s.boolBtn,g[b.key]&&s.boolBtnActive]}>
                        <Text style={{fontSize:18}}>{b.icon}</Text>
                        <Text style={[s.boolText,g[b.key]&&{color:C.accentPink}]}>{b.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Note */}
                  <TextInput style={s.noteInput} value={g.notes||''} onChangeText={t=>updateField(item.id,'notes',t)}
                    placeholder="Note..." placeholderTextColor={C.muted} multiline/>
                </View>
              )}
            </View>
          );
        }}
      />
    </ScreenLayout>
  );
}

const s=StyleSheet.create({
  saveBtn:      {flexDirection:'row',alignItems:'center',gap:4,backgroundColor:C.accentPink,borderRadius:10,paddingHorizontal:12,paddingVertical:6},
  dateNav:      {flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:12,backgroundColor:C.white,borderBottomWidth:0.5,borderBottomColor:C.border},
  navBtn:       {width:32,height:32,alignItems:'center',justifyContent:'center'},
  dateText:     {fontSize:14,fontWeight:'700',color:C.text,textTransform:'capitalize'},
  bulkBar:      {margin:8,backgroundColor:'#FFF0F7',borderRadius:12,padding:10},
  bulkLabel:    {fontSize:12,fontWeight:'600',color:C.accentPink},
  qtyMini:      {paddingHorizontal:6,paddingVertical:3,borderRadius:6},
  qtyMiniText:  {fontSize:10,fontWeight:'600'},
  selectRow:    {paddingHorizontal:12,paddingVertical:4},
  selectAllBtn: {flexDirection:'row',alignItems:'center',gap:6},
  studentCard:  {backgroundColor:C.white,borderRadius:12,marginBottom:6,borderWidth:0.5,borderColor:C.border,overflow:'hidden'},
  studentCardSelected:{borderColor:C.accentPink},
  studentHeader:{flexDirection:'row',alignItems:'center',padding:10},
  studentName:  {fontSize:14,fontWeight:'700',color:C.text},
  miniBadge:    {backgroundColor:'#FFF0F7',borderRadius:20,paddingHorizontal:8,paddingVertical:2},
  miniBadgeText:{fontSize:10,color:C.accentPink,fontWeight:'600'},
  fields:       {borderTopWidth:0.5,borderTopColor:C.border,padding:10},
  mealRow:      {flexDirection:'row',alignItems:'center',marginBottom:8},
  mealIcon:     {fontSize:18,width:28},
  mealLabel:    {fontSize:12,fontWeight:'600',color:C.muted,width:90},
  qtyBtn:       {paddingHorizontal:8,paddingVertical:5,borderRadius:20,borderWidth:0.5},
  qtyBtnText:   {fontSize:11,fontWeight:'600'},
  boolRow:      {flexDirection:'row',gap:10,marginTop:4,marginBottom:8},
  boolBtn:      {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:10,borderRadius:10,backgroundColor:'#F9FAFB',borderWidth:0.5,borderColor:C.border},
  boolBtnActive:{backgroundColor:'#FFF0F7',borderColor:C.accentPink},
  boolText:     {fontSize:13,fontWeight:'600',color:C.muted},
  noteInput:    {borderWidth:0.5,borderColor:C.border,borderRadius:8,padding:8,fontSize:12,color:C.text,minHeight:40},
});
