import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../components/layout/ScreenLayout';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

const C = { primary: '#4169E1', white: '#FFFFFF', text: '#1A202C', muted: '#9CA3AF', border: '#F3F4F6', green: '#32CD32', red: '#EF4444' };

function addDays(n:number){const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().split('T')[0];}

export default function TeacherPresenze() {
  const { user } = useAuth();
  const classId = user?.class_ids?.[0] || user?.class_id;
  const [tab, setTab]         = useState<'oggi'|'mese'|'anno'>('oggi');
  const [date, setDate]       = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<any[]>([]);
  const [presenze, setPresenze] = useState<Record<string,{presente:boolean;nota:string}>>({});
  const [archivio, setArchivio] = useState<any[]>([]);
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    if(!classId){setLoading(false);return;}
    api.get(`/students?class_id=${classId}`).then(r=>setStudents(r.data||[])).catch(()=>{}).finally(()=>setLoading(false));
  },[classId]);

  useEffect(()=>{
    if(!classId||!students.length)return;
    if(tab==='oggi'){
      api.get(`/presenze?class_id=${classId}&date=${date}`).then(r=>{
        const map:Record<string,{presente:boolean;nota:string}>={};
        (r.data||[]).forEach((p:any)=>{map[p.student_id]={presente:p.presente,nota:p.nota||''};});
        setPresenze(map);
      }).catch(()=>{});
    } else {
      const now=new Date();
      const params=tab==='mese'?`mese=${now.getMonth()+1}&anno=${now.getFullYear()}`:`anno=${now.getFullYear()}`;
      api.get(`/presenze?class_id=${classId}&${params}`).then(r=>setArchivio(r.data||[])).catch(()=>{});
    }
  },[date,classId,tab,students]);

  const toggle=(id:string)=>setPresenze(prev=>({...prev,[id]:{presente:!prev[id]?.presente,nota:prev[id]?.nota||''}}));
  const setNota=(id:string,nota:string)=>setPresenze(prev=>({...prev,[id]:{...prev[id],nota}}));
  const setAll=(presente:boolean)=>{
    const map:Record<string,{presente:boolean;nota:string}>={};
    students.forEach(s=>{map[s.id]={presente,nota:presenze[s.id]?.nota||''};});
    setPresenze(map);
  };

  const handleSave=async()=>{
    setSaving(true);
    try{
      await Promise.all(students.map(st=>
        api.post('/presenze',{student_id:st.id,class_id:classId,date,presente:!!presenze[st.id]?.presente,nota:presenze[st.id]?.nota||''})
      ));
      Alert.alert('Salvato','Presenze aggiornate ✅');
    }catch{Alert.alert('Errore','Impossibile salvare');}
    finally{setSaving(false);}
  };

  const presentCount=students.filter(s=>presenze[s.id]?.presente).length;

  return (
    <ScreenLayout title="Registro Presenze" showBack color={C.primary} loading={loading} scrollable={false}
      rightAction={
        tab==='oggi'?(
          <TouchableOpacity onPress={handleSave} disabled={saving} style={[s.saveBtn,saving&&{opacity:0.5}]}>
            <Text style={s.saveBtnText}>{saving?'...':'Salva'}</Text>
          </TouchableOpacity>
        ):undefined
      }
    >
      {/* Tabs */}
      <View style={s.tabs}>
        {(['oggi','mese','anno'] as const).map(t=>(
          <TouchableOpacity key={t} onPress={()=>setTab(t)} style={[s.tab,tab===t&&s.tabActive]}>
            <Text style={[s.tabText,tab===t&&s.tabTextActive]}>{t.charAt(0).toUpperCase()+t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab==='oggi'&&(
        <>
          {/* Date nav */}
          <View style={s.dateNav}>
            <TouchableOpacity onPress={()=>setDate(addDays(-1))} style={s.navBtn}>
              <Ionicons name="chevron-back" size={20} color={C.text}/>
            </TouchableOpacity>
            <View style={{alignItems:'center'}}>
              <Text style={s.dateText}>{new Date(date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})}</Text>
              <Text style={s.dateStats}>{presentCount}/{students.length} presenti</Text>
            </View>
            <TouchableOpacity onPress={()=>setDate(addDays(1))} style={s.navBtn}
              disabled={date>=new Date().toISOString().split('T')[0]}>
              <Ionicons name="chevron-forward" size={20} color={date>=new Date().toISOString().split('T')[0]?C.muted:C.text}/>
            </TouchableOpacity>
          </View>

          {/* Bulk */}
          <View style={s.bulkRow}>
            <TouchableOpacity onPress={()=>setAll(true)} style={[s.bulkBtn,{borderColor:C.green}]}>
              <Ionicons name="checkmark-circle-outline" size={16} color={C.green}/>
              <Text style={{fontSize:12,color:C.green,fontWeight:'700'}}>Tutti presenti</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>setAll(false)} style={[s.bulkBtn,{borderColor:C.red}]}>
              <Ionicons name="close-circle-outline" size={16} color={C.red}/>
              <Text style={{fontSize:12,color:C.red,fontWeight:'700'}}>Tutti assenti</Text>
            </TouchableOpacity>
          </View>

          <FlatList data={students} keyExtractor={s_=>s_.id} contentContainerStyle={{padding:8}}
            renderItem={({item})=>{
              const p=presenze[item.id];
              return(
                <View style={s.studentCard}>
                  <TouchableOpacity onPress={()=>toggle(item.id)} style={[s.checkbox,p?.presente&&s.checkboxActive]}>
                    {p?.presente&&<Ionicons name="checkmark" size={16} color={C.white}/>}
                  </TouchableOpacity>
                  <View style={{flex:1}}>
                    <Text style={[s.studentName,{color:p?.presente?C.text:C.muted}]}>{item.name} {item.cognome}</Text>
                    {!p?.presente&&(
                      <TextInput style={s.noteInput} value={p?.nota||''} onChangeText={t=>setNota(item.id,t)}
                        placeholder="Nota assenza..." placeholderTextColor={C.muted}/>
                    )}
                  </View>
                  <View style={[s.statusDot,{backgroundColor:p?.presente?C.green:C.red}]}/>
                </View>
              );
            }}
          />
        </>
      )}

      {(tab==='mese'||tab==='anno')&&(
        <FlatList data={archivio} keyExtractor={(_,i)=>String(i)} contentContainerStyle={{padding:12}}
          ListEmptyComponent={<View style={{alignItems:'center',paddingTop:40}}><Text style={{fontSize:40}}>📊</Text><Text style={{color:C.muted,marginTop:10}}>Nessun dato archivio</Text></View>}
          renderItem={({item})=>(
            <View style={s.archCard}>
              <Text style={s.archDate}>{item.date||item.month}</Text>
              <View style={{flexDirection:'row',gap:12}}>
                <Text style={{fontSize:12,color:C.green}}>✓ {item.presenti||0} presenti</Text>
                <Text style={{fontSize:12,color:C.red}}>✗ {item.assenti||0} assenti</Text>
              </View>
            </View>
          )}
        />
      )}
    </ScreenLayout>
  );
}

const s=StyleSheet.create({
  saveBtn:      {backgroundColor:C.primary,borderRadius:10,paddingHorizontal:12,paddingVertical:6},
  saveBtnText:  {color:C.white,fontWeight:'700',fontSize:13},
  tabs:         {flexDirection:'row',margin:10,backgroundColor:C.white,borderRadius:10,padding:3,borderWidth:0.5,borderColor:C.border},
  tab:          {flex:1,paddingVertical:8,alignItems:'center',borderRadius:8},
  tabActive:    {backgroundColor:C.primary},
  tabText:      {fontSize:13,fontWeight:'600',color:C.muted},
  tabTextActive:{color:C.white},
  dateNav:      {flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:12,backgroundColor:C.white,borderBottomWidth:0.5,borderBottomColor:C.border},
  navBtn:       {width:32,height:32,alignItems:'center',justifyContent:'center'},
  dateText:     {fontSize:13,fontWeight:'700',color:C.text,textTransform:'capitalize',textAlign:'center'},
  dateStats:    {fontSize:11,color:C.muted,textAlign:'center',marginTop:2},
  bulkRow:      {flexDirection:'row',gap:8,padding:10},
  bulkBtn:      {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingVertical:8,borderRadius:10,borderWidth:1,backgroundColor:C.white},
  studentCard:  {flexDirection:'row',alignItems:'center',gap:10,backgroundColor:C.white,borderRadius:12,padding:10,marginBottom:6,borderWidth:0.5,borderColor:C.border},
  checkbox:     {width:28,height:28,borderRadius:8,borderWidth:2,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  checkboxActive:{backgroundColor:C.green,borderColor:C.green},
  studentName:  {fontSize:14,fontWeight:'700'},
  noteInput:    {fontSize:12,color:C.text,borderBottomWidth:0.5,borderBottomColor:C.border,marginTop:3,paddingBottom:1},
  statusDot:    {width:10,height:10,borderRadius:5},
  archCard:     {backgroundColor:C.white,borderRadius:12,padding:12,marginBottom:6,borderWidth:0.5,borderColor:C.border},
  archDate:     {fontSize:13,fontWeight:'700',color:C.text,marginBottom:4},
});
