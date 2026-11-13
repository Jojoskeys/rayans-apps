# Sorties audio de Windows : liste (par défaut) ou choix de la sortie par défaut (-Choisir <id>).
# Utilise les interfaces COM de Windows (MMDevice, PolicyConfig) : aucun module à installer.
# Sortie : JSON sur une ligne.
param([string]$Choisir = "")
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace RayanSon {
  [StructLayout(LayoutKind.Sequential)] public struct PropKey { public Guid fmtid; public int pid; }
  [StructLayout(LayoutKind.Explicit)] public struct PropVariant { [FieldOffset(0)] public short vt; [FieldOffset(8)] public IntPtr p; }

  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
  }
  [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceCollection { int GetCount(out int count); int Item(int index, out IMMDevice device); }
  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    int Activate(ref Guid iid, int clsCtx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o);
    int OpenPropertyStore(int access, out IPropertyStore store);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    int GetState(out int state);
  }
  [ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPropertyStore {
    int GetCount(out int count);
    int GetAt(int i, out PropKey key);
    int GetValue(ref PropKey key, out PropVariant value);
  }
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator {}

  [ComImport, Guid("f8679f50-850a-41cf-9c72-430f290290c8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPolicyConfig {
    int GetMixFormat(); int GetDeviceFormat(); int ResetDeviceFormat(); int SetDeviceFormat();
    int GetProcessingPeriod(); int SetProcessingPeriod(); int GetShareMode(); int SetShareMode();
    int GetPropertyValue(); int SetPropertyValue();
    int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string id, int role);
    int SetEndpointVisibility();
  }
  [ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")] class CPolicyConfigClient {}

  public class Sortie { public string id; public string nom; public bool parDefaut; }

  public static class Audio {
    public static List<Sortie> Lister() {
      var en = (IMMDeviceEnumerator)new MMDeviceEnumerator();
      string defId = null;
      IMMDevice def;
      if (en.GetDefaultAudioEndpoint(0, 1, out def) == 0 && def != null) def.GetId(out defId);
      IMMDeviceCollection col;
      Marshal.ThrowExceptionForHR(en.EnumAudioEndpoints(0, 1, out col)); // rendu, actives
      int n; col.GetCount(out n);
      var key = new PropKey { fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"), pid = 14 }; // nom convivial
      var res = new List<Sortie>();
      for (int i = 0; i < n; i++) {
        IMMDevice d; col.Item(i, out d);
        string id; d.GetId(out id);
        IPropertyStore ps; d.OpenPropertyStore(0, out ps);
        PropVariant v; ps.GetValue(ref key, out v);
        string nom = v.vt == 31 ? Marshal.PtrToStringUni(v.p) : id;
        res.Add(new Sortie { id = id, nom = nom, parDefaut = id == defId });
      }
      return res;
    }
    public static void Choisir(string id) {
      var pc = (IPolicyConfig)new CPolicyConfigClient();
      for (int role = 0; role < 3; role++) Marshal.ThrowExceptionForHR(pc.SetDefaultEndpoint(id, role));
    }
  }
}
"@

if ($Choisir) { [RayanSon.Audio]::Choisir($Choisir) }
$liste = @([RayanSon.Audio]::Lister() | ForEach-Object { [ordered]@{ id = $_.id; nom = $_.nom; parDefaut = $_.parDefaut } })
ConvertTo-Json -InputObject $liste -Compress -Depth 3
