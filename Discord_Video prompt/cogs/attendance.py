from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands

from reporting import build_monthly_pdf, entry_duration, format_duration
from services import AttendanceService


class AttendanceCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.service: AttendanceService = bot.attendance_service

    @app_commands.command(name="clockin", description="ลงเวลาเข้างาน")
    async def clockin(self, interaction: discord.Interaction) -> None:
        if not await self.service.ensure_channel(interaction):
            return
        ts = datetime.now(self.bot.settings.timezone)
        entry = self.service.db.clock_in(
            interaction.user.id,
            self.service.bot_display_name(interaction.user),
            ts.date(),
            ts,
        )
        await interaction.response.send_message(
            f"ลงเวลาเข้างานแล้วเมื่อ {ts.strftime('%H:%M')} น.",
            ephemeral=True,
        )
        await self.service.safe_emit_log("clockin", entry)

    @app_commands.command(name="clockout", description="ลงเวลาออกงาน")
    async def clockout(self, interaction: discord.Interaction) -> None:
        if not await self.service.ensure_channel(interaction):
            return
        ts = datetime.now(self.bot.settings.timezone)
        try:
            entry = self.service.db.clock_out(
                interaction.user.id,
                self.service.bot_display_name(interaction.user),
                ts.date(),
                ts,
            )
        except ValueError:
            await interaction.response.send_message(
                "ยังไม่พบเวลาเข้างานของวันนี้ กรุณาใช้ /clockin ก่อน",
                ephemeral=True,
            )
            return
        await interaction.response.send_message(
            f"ลงเวลาออกงานแล้ว คุณทำงานไป {format_duration(entry_duration(entry))}",
            ephemeral=True,
        )
        await self.service.safe_emit_log("clockout", entry)

    @app_commands.command(name="status", description="เช็คสถานะการลงเวลาวันนี้")
    async def status(self, interaction: discord.Interaction) -> None:
        if not await self.service.ensure_channel(interaction):
            return
        ts = datetime.now(self.bot.settings.timezone)
        entry = self.service.db.get_today_entry(interaction.user.id, ts.date())
        if not entry:
            await interaction.response.send_message("วันนี้ยังไม่มีข้อมูลลงเวลา", ephemeral=True)
            return
        if entry.status == "completed":
            message = f"วันนี้คุณทำงานครบแล้ว รวม {format_duration(entry_duration(entry))}"
        elif entry.clock_in:
            clock_in = datetime.fromisoformat(entry.clock_in).strftime("%H:%M")
            message = f"วันนี้คุณ clock-in แล้วเมื่อ {clock_in} น."
        else:
            message = f"วันนี้สถานะของคุณคือ {entry.status}: {entry.reason or '-'}"
        await interaction.response.send_message(message, ephemeral=True)

    @app_commands.command(name="summary", description="สร้างรายงานสรุปรายเดือนเป็น PDF")
    @app_commands.describe(year="ปี ค.ศ. เช่น 2026", month="เดือน 1-12")
    async def summary(
        self,
        interaction: discord.Interaction,
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> None:
        if not await self.service.ensure_channel(interaction):
            return
        await interaction.response.defer(ephemeral=True, thinking=True)
        ts = datetime.now(self.bot.settings.timezone)
        year = year or ts.year
        month = month or ts.month
        if month < 1 or month > 12:
            await interaction.followup.send("เดือนต้องอยู่ระหว่าง 1-12", ephemeral=True)
            return
        entries = self.service.db.month_entries(interaction.user.id, year, month)
        daily_rate = self.service.db.daily_rate_for(interaction.user.id)
        employee = self.service.db.get_employee(interaction.user.id)
        report_name = (
            employee.full_name
            if employee and employee.full_name
            else self.service.bot_display_name(interaction.user)
        )
        report_path = Path("reports") / f"attendance_{interaction.user.id}_{year:04d}_{month:02d}.pdf"
        build_monthly_pdf(
            report_path,
            report_name,
            year,
            month,
            entries,
            daily_rate,
        )
        if self.service.storage:
            self.service.storage.upload_report(
                report_path,
                interaction.user.id,
                year,
                month,
            )
        await interaction.followup.send(
            "สร้างรายงานสรุปรายเดือนเรียบร้อย",
            file=discord.File(report_path),
            ephemeral=True,
        )

    @app_commands.command(name="absent", description="ลางาน พร้อมระบุเหตุผล")
    @app_commands.describe(reason="เหตุผลการลา")
    async def absent(self, interaction: discord.Interaction, reason: str) -> None:
        await self._mark(interaction, "absent", reason, f"บันทึกลางานแล้ว: {reason}")

    @app_commands.command(name="wfh", description="แจ้งทำงานจากบ้าน")
    async def wfh(self, interaction: discord.Interaction) -> None:
        await self._mark(interaction, "wfh", None, "บันทึกสถานะทำงานจากบ้านแล้ว")

    @app_commands.command(name="late", description="แจ้งสาเหตุมาสาย")
    @app_commands.describe(reason="สาเหตุมาสาย")
    async def late(self, interaction: discord.Interaction, reason: str) -> None:
        await self._mark(interaction, "late", reason, f"บันทึกมาสายแล้ว: {reason}")

    @app_commands.command(name="holidaycoming", description="เตือนวันหยุดที่ใกล้มาถึง")
    async def holidaycoming(self, interaction: discord.Interaction) -> None:
        await interaction.response.send_message(
            "ยังไม่ได้เชื่อมต่อปฏิทินวันหยุด",
            ephemeral=True,
        )

    async def _mark(
        self,
        interaction: discord.Interaction,
        status: str,
        reason: Optional[str],
        response: str,
    ) -> None:
        if not await self.service.ensure_channel(interaction):
            return
        ts = datetime.now(self.bot.settings.timezone)
        entry = self.service.db.mark_status(
            interaction.user.id,
            self.service.bot_display_name(interaction.user),
            ts.date(),
            status,
            reason,
            ts,
        )
        await interaction.response.send_message(response, ephemeral=True)
        await self.service.safe_emit_log(status, entry)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(AttendanceCog(bot))
